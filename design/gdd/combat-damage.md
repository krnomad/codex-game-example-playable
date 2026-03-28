# 전투/데미지 계산 (Combat / Damage Calculation)

> **Status**: Designed
> **Author**: systems-designer + user
> **Last Updated**: 2026-03-28
> **Implements Pillar**: 전투 (모든 영웅 공격, 데미지 판정, 피격 반응의 핵심 규칙)

---

## Overview

풍운지기의 전투/데미지 계산 시스템은 영웅(HeroUnit)이 슬롯에 고정된 채로 사거리 내
적(EnemyUnit)을 자동 공격하는 타워디펜스 전투 루프를 규정한다. 영웅은 공격 대상을
선택하고, 타이머 기반 공격 주기에 따라 공격을 실행하며, 물리/마법 두 가지 피해 유형
중 하나로 데미지를 계산해 적의 `current_hp`를 차감한다. 크리티컬 히트, 아머/마법저항
감소, 강화 배율(Unit Base가 이미 `final_atk`에 적용)이 조합되어 최종 피해량을
결정한다. 계산된 피해량은 VFX/파티클 시스템과 Battle HUD에 이벤트로 전달되어
플로팅 데미지 숫자와 HP 바 갱신을 유발한다. 적의 HP가 0 이하로 떨어지면 Wave Defense
시스템이 처리하는 `unit_died` 시그널이 발행된다.

---

## Player Fantasy

> "내 +7 무사가 화면에 등장했다. 금빛 오라를 두른 채 칼집에서 도를 뽑아든다.
> 첫 번째 화염 도깨비가 사거리 안에 들어오는 순간 — **쿵!** 크리티컬!
> 새빨간 숫자가 화면을 가르며 튀어오른다. 강화가 15배율의 위력을 만들어냈다.
> 일반 무사라면 두 방에 잡을 적을 단 한 방에 쓰러뜨린다.
> 이 영웅을 여기까지 키우는 데 얼마나 많은 강화석을 썼던가 — 그 모든 게
> 이 순간 하나의 타격으로 보답받는다."

플레이어가 원하는 감각:
- **강화가 눈에 보인다**: +7, +10 영웅이 숫자로만이 아닌 타격감으로 강하다는 걸 안다
- **크리티컬의 짜릿함**: 붉은 크리티컬 숫자는 예측 불가의 쾌감을 준다
- **직관적 피드백**: 아머가 높은 적은 숫자가 줄어드는 걸 보며 "마법 영웅이 필요하다"는 전략적 판단이 자연스럽게 나온다
- **속도감**: 60fps에서 타격-숫자-피격 이펙트가 프레임 지연 없이 연결된다

---

## Detailed Design

### 전투 루프 개요

영웅의 전투 루프는 `_process(delta)` 내에서 다음 순서로 실행된다.
STUNNED 또는 USING_SKILL 상태에서는 루프가 중단된다.

```
[매 프레임]
  1. 상태 확인 → STUNNED이면 중단, USING_SKILL이면 중단
  2. 공격 타이머 차감
  3. 타이머 ≤ 0 이면:
       a. 사거리 내 적 목록 조회
       b. 타겟 선택 (Target Selection 규칙 적용)
       c. 타겟 없으면 → IDLE 전환 후 종료
       d. 타겟 있으면 → 데미지 계산 → apply_damage() 호출
       e. 공격 타이머 리셋 (attack_interval)
       f. ATTACKING 상태 유지 (모션은 AnimatedSprite가 처리)
  4. 사거리 내 적 없음 + 타이머 리셋 완료 → IDLE 전환
```

### 공격 타이머 (Attack Timer)

`base_atk_speed`는 **초당 공격 횟수(attacks per second)**를 의미한다.

```
attack_interval = 1.0 / final_atk_speed
```

공격 타이머는 누적 방식이다. 타이머가 0 이하가 되는 순간 공격이 실행되고,
`attack_interval`만큼 더해 리셋한다 (누적 오차 방지).

```gdscript
attack_timer -= delta
if attack_timer <= 0.0:
    _execute_attack()
    attack_timer += attack_interval  # 리셋이 아닌 누적 더하기
```

| 변수 | 값 범위 | 설명 |
|------|---------|------|
| `base_atk_speed` | 0.8 ~ 1.5 | heroes.json 원본 값, 초당 공격 횟수 |
| `final_atk_speed` | 0.8 ~ 1.5 | MVP에서는 배율 없음, base와 동일 |
| `attack_interval` | 0.67 ~ 1.25초 | 공격과 공격 사이의 간격 |

> **설계 결정**: MVP에서 `atk_speed`는 강화 배율을 받지 않는다.
> 속도 배율은 post-MVP 스킬 버프 등으로 도입 예정.

### 사거리 감지 (Range Detection)

영웅의 `slot_position`(전투 중 불변)을 중심으로 반경 `final_range` 픽셀 이내의
EnemyUnit을 감지한다.

```
in_range = hero.slot_position.distance_to(enemy.global_position) <= hero.final_range
```

사거리 내 적 목록은 매 공격 타이머 만료 시점에 CombatSystem이 조회한다.
적 이동이 연속적이므로, 타이머 만료마다 재계산하는 것이 정확하다.

> **구현 노트**: 물리 레이어 충돌 대신 거리 계산으로 구현.
> 적 최대 동시 수는 20~30체 수준이므로 O(n) 순회 성능 충분.

### 타겟 선택 (Target Selection)

MVP에서는 모든 영웅이 **경로 진행 우선 (Furthest Along Path)** 방식을 사용한다.
사거리 내 적 중 `distance_traveled` 값이 가장 큰 적을 타겟으로 선택한다.

```gdscript
func _select_target(candidates: Array[EnemyUnit]) -> EnemyUnit:
    if candidates.is_empty():
        return null
    candidates.sort_custom(func(a, b): return a.distance_traveled > b.distance_traveled)
    return candidates[0]
```

**설계 근거**: 타워디펜스에서 경로를 가장 많이 진행한 적이 가장 큰 위협이다.
이 방식은 Kingdom Rush의 기본 동작과 동일하여 플레이어가 직관적으로 이해한다.

> **post-MVP 확장**: `target_priority` 필드를 heroes.json에 추가해
> `NEAREST` / `LOWEST_HP` / `HIGHEST_HP` 옵션을 영웅별로 설정 가능하도록 확장 예정.
> MVP에서는 전체 고정.

### 피해 유형 (Damage Types)

영웅의 `atk_type`(heroes.json)에 따라 두 가지 피해 유형이 결정된다.

| 피해 유형 | `atk_type` 값 | 감소 스탯 | 주요 영웅 |
|-----------|--------------|-----------|----------|
| 물리 피해 | `"physical"` | `enemy.armor` | 무사, 궁수 |
| 마법 피해 | `"magical"` | `enemy.magic_resist` | 도사, 무녀 |

MVP 영웅 4종의 atk_type 배정:

| 영웅 | `atk_type` | 근거 |
|------|-----------|------|
| 무사 (WARRIOR) | `"physical"` | 근접 도검, 바람의나라 전사 클래스 |
| 궁수 (ARCHER) | `"physical"` | 화살은 물리 공격 |
| 도사 (MAGE) | `"magical"` | 도술, 부적, 번개 — 마법 속성 |
| 무녀 (SUPPORT) | `"magical"` | 주술, 정령 — 마법 속성 |

> **설계 결정**: 바람의나라 직업군의 물리/마법 이분법을 그대로 반영한다.
> 적의 `armor`와 `magic_resist`가 분리되어 있어, 플레이어가 적 구성에 따라
> 물리/마법 영웅 편성을 고민하는 전략적 선택이 만들어진다.

### 데미지 계산 공식 (Damage Calculation)

#### 기본 피해량

피해 유형에 따라 다른 방어 스탯을 차감한다. 최소 1 보장.

```
# 물리 피해
raw_damage = hero.final_atk
reduced_damage = raw_damage - enemy.armor
effective_damage = max(1, reduced_damage)

# 마법 피해
raw_damage = hero.final_atk
reduced_damage = raw_damage - enemy.magic_resist
effective_damage = max(1, reduced_damage)
```

#### 크리티컬 히트

크리티컬은 `base_crit_rate` 확률로 발생한다. 크리티컬 발생 시 데미지에
`base_crit_damage` 배율을 곱한다.

```
is_crit = (randf() < hero.base_crit_rate)
if is_crit:
    final_damage = effective_damage * hero.base_crit_damage
else:
    final_damage = effective_damage
```

`final_damage`는 float이며, `apply_damage()` 호출 시 `int`로 절사(floor)한다.

#### 최종 피해 적용

```
enemy.current_hp = max(0.0, enemy.current_hp - final_damage)
if enemy.current_hp == 0.0:
    enemy.transition_to(UnitState.DEAD)
    emit_signal("unit_died", enemy)
```

#### 전체 파이프라인 요약

```
raw_damage
  → (-) armor or magic_resist
  → max(1, result)          [effective_damage]
  → (×) crit_damage if crit [final_damage]
  → floor()                  [int 변환]
  → enemy.current_hp 차감
  → 피해 이벤트 발행 (VFX, HUD)
```

### 크리티컬 히트 파라미터

`base_crit_rate`와 `base_crit_damage`는 heroes.json에서 영웅별로 정의된다.

MVP 기본값:

| 영웅 | `base_crit_rate` | `base_crit_damage` | 근거 |
|------|-----------------|-------------------|------|
| 무사 | 0.10 (10%) | 1.5× | 단일 집중 타격, 적정 크리율 |
| 궁수 | 0.20 (20%) | 2.0× | 정밀 사격 클래스, 크리 특화 |
| 도사 | 0.05 (5%) | 1.8× | 마법 충전형, 낮은 빈도 고배율 |
| 무녀 | 0.08 (8%) | 1.5× | 지원 위주, 크리 부차적 |

**설계 근거**: 궁수는 높은 크리율로 예측 불가한 버스트를, 도사는 낮은 크리율로
크리 발생 시 강한 인상을 준다. 클래스 정체성과 연결된 크리 프로파일.

> **MVP 제약**: `base_crit_rate`와 `base_crit_damage`는 강화 레벨에 영향받지 않는다.
> 강화는 `final_atk` 배율을 통해 크리티컬의 절대 피해량을 간접적으로 높인다.

### 다중 타겟 공격 (Area Attack)

MVP에서 기본 일반 공격은 **단일 타겟**이다. 영웅의 `atk_area` 값이 `0`이면
타겟 1체에만 피해가 적용된다.

도사(MAGE) 등 광역 공격 영웅은 `atk_area > 0`을 가질 수 있다.
이 경우 타겟을 중심으로 `atk_area` 반경 내 모든 적에게 동일한 `final_damage`를 적용한다.

```gdscript
# atk_area = 0: 단일 타겟
if hero_data.atk_area == 0:
    _apply_damage_to(target, final_damage, is_crit)
# atk_area > 0: 광역
else:
    var area_targets = _get_enemies_in_radius(target.global_position, hero_data.atk_area)
    for t in area_targets:
        _apply_damage_to(t, final_damage, is_crit)
```

> **설계 결정**: 광역 공격도 크리티컬은 1회 판정한다 (`is_crit`이 모든 타겟에 동일하게 적용).
> 타겟마다 독립 크리티컬 판정은 MVF에서는 복잡도 대비 체감이 낮아 제외.

MVP 영웅별 `atk_area`:

| 영웅 | `atk_area` | 비고 |
|------|-----------|------|
| 무사 | 0 | 단일 근접 |
| 궁수 | 0 | 단일 원거리 |
| 도사 | 40px | 소형 광역 (번개 부적) |
| 무녀 | 0 | 단일, 스킬에서 광역 버프 |

### 피해 이벤트 시그널

데미지가 적용될 때마다 CombatSystem은 다음 시그널을 발행한다.

```gdscript
signal damage_dealt(
    attacker: HeroUnit,
    target: EnemyUnit,
    damage: int,
    is_crit: bool,
    damage_type: String  # "physical" or "magical"
)
```

이 시그널을 구독하는 시스템:
- **VFX/파티클**: 피격 이펙트, 크리티컬 강조 이펙트 재생
- **Battle HUD**: 플로팅 데미지 숫자 생성, HP 바 갱신

### 플로팅 데미지 숫자 (Floating Damage Numbers)

`damage_dealt` 시그널 수신 시 Battle HUD가 플로팅 텍스트를 생성한다.
Combat 시스템은 숫자 형식을 **정의만** 하고, 렌더링은 Battle HUD 책임이다.

| 조건 | 색상 | 폰트 크기 | 접두사 |
|------|------|----------|-------|
| 일반 물리 피해 | 흰색 (`#FFFFFF`) | 14px | 없음 |
| 일반 마법 피해 | 하늘색 (`#88CCFF`) | 14px | 없음 |
| 크리티컬 물리 | 빨간색 (`#FF3333`) | 20px | 없음 |
| 크리티컬 마법 | 보라색 (`#CC44FF`) | 20px | 없음 |
| 최소 피해 (=1) | 회색 (`#888888`) | 12px | 없음 |

플로팅 텍스트 동작:
- 적의 `get_vfx_anchor()` 위치에서 생성 (`global_position + Vector2(0, -8)`)
- 0.8초 동안 위로 +20px 이동 후 페이드 아웃
- 크리티컬은 생성 시 0.2초 간 1.3× 스케일 팝 애니메이션

> **성능 제약**: 플로팅 텍스트는 Label 노드 풀링으로 구현. 동시 최대 20개 제한.
> 초과 시 가장 오래된 것부터 재사용.

---

## Formulas

### 1. 물리 피해 최종값

```
effective_damage_physical = max(1, hero.final_atk - enemy.armor)
final_damage = floor(effective_damage_physical × crit_multiplier)

where:
  crit_multiplier = hero.base_crit_damage  if is_crit
                  = 1.0                    otherwise
  is_crit         = (randf() < hero.base_crit_rate)
```

**변수 정의**:

| 변수 | 출처 | MVP 범위 |
|------|------|---------|
| `hero.final_atk` | Unit Base 계산 결과 (`base_atk × atk_multiplier`) | 18.0 ~ 96.0 |
| `enemy.armor` | enemies.json `stats.armor` | 0 ~ 15 |
| `effective_damage_physical` | 계산 결과 | 1 ~ 96 |
| `hero.base_crit_rate` | heroes.json `base_crit_rate` | 0.05 ~ 0.20 |
| `hero.base_crit_damage` | heroes.json `base_crit_damage` | 1.5 ~ 2.0 |
| `final_damage` (크리 없음) | 계산 결과 | 1 ~ 96 |
| `final_damage` (크리) | 계산 결과 | 1 ~ 192 |

**예시 계산 A — 무사 +7 vs 돌 트롤 (물리, 일반)**:
```
hero.final_atk  = 40 × 1.55 = 62.0
enemy.armor     = 5
effective       = max(1, 62.0 - 5) = 57.0
is_crit         = false
final_damage    = floor(57.0 × 1.0) = 57
```

**예시 계산 B — 무사 +7 vs 돌 트롤 (물리, 크리티컬)**:
```
hero.final_atk  = 62.0
effective       = 57.0
is_crit         = true  (base_crit_rate 10% 발생)
final_damage    = floor(57.0 × 1.5) = floor(85.5) = 85
```

**예시 계산 C — 무사 +0 vs 돌 트롤 (아머 방벽)**:
```
hero.final_atk  = 40 × 1.00 = 40.0
enemy.armor     = 5
effective       = max(1, 40.0 - 5) = 35.0
final_damage    = 35
```

### 2. 마법 피해 최종값

```
effective_damage_magical = max(1, hero.final_atk - enemy.magic_resist)
final_damage = floor(effective_damage_magical × crit_multiplier)
```

**변수 정의**:

| 변수 | 출처 | MVP 범위 |
|------|------|---------|
| `enemy.magic_resist` | enemies.json `stats.magic_resist` | 0 ~ 10 |
| `effective_damage_magical` | 계산 결과 | 1 ~ 96 |

> **설계 결정**: MVP enemies.json에 `magic_resist` 필드를 추가한다.
> `armor`만 있고 `magic_resist`가 없으면 마법/물리 구분이 무의미해진다.
> 초기 설정값: fire_oni=0, phantom_archer=0, stone_troll=0, dark_shaman_boss=5

**예시 계산 D — 도사 +5 vs 암흑 무당 (마법)**:
```
hero.final_atk  = 35 × 1.30 = 45.5
enemy.magic_resist = 5
effective       = max(1, 45.5 - 5) = 40.5
final_damage    = floor(40.5 × 1.0) = 40
```

**예시 계산 E — 도사 +5 vs 암흑 무당 (마법, 크리티컬)**:
```
effective       = 40.5
is_crit         = true  (base_crit_rate 5% 발생)
final_damage    = floor(40.5 × 1.8) = floor(72.9) = 72
```

### 3. 공격 주기

```
attack_interval = 1.0 / hero.final_atk_speed
```

| 영웅 | `base_atk_speed` | `attack_interval` |
|------|-----------------|------------------|
| 무사 | 1.2 | 0.83초 |
| 궁수 | 1.5 | 0.67초 |
| 도사 | 0.8 | 1.25초 |
| 무녀 | 1.0 | 1.00초 |

### 4. 사거리 판정

```
in_range = hero.slot_position.distance_to(enemy.global_position) <= hero.final_range
```

### 5. DPS 추정 (밸런스 참고용, 실시간 계산 아님)

```
expected_dps = effective_damage × (1 + crit_rate × (crit_damage - 1)) × atk_speed

where:
  effective_damage = max(1, final_atk - armor)
  [크리티컬 기대값 = 일반 + 크리 확률 × 추가 배율]
```

**DPS 예시 — 무사 +7 vs 돌 트롤 (아머 5)**:
```
effective_damage = 57.0
crit_contribution = 1 + 0.10 × (1.5 - 1) = 1 + 0.05 = 1.05
expected_dps = 57.0 × 1.05 × 1.2 = 71.8 DPS
```

**DPS 예시 — 궁수 +0 vs 화염 도깨비 (아머 0)**:
```
effective_damage = 30.0
crit_contribution = 1 + 0.20 × (2.0 - 1) = 1 + 0.20 = 1.20
expected_dps = 30.0 × 1.20 × 1.5 = 54.0 DPS
```

---

## Edge Cases

| 상황 | 처리 규칙 |
|------|----------|
| **사거리 내 적 없음** | 타겟 선택 단계에서 `null` 반환. 공격 미실행. 영웅은 IDLE 전환. 공격 타이머는 리셋하지 않고 0에서 대기. 적이 다시 감지되면 즉시 공격 (다음 타이머 만료 없이). |
| **공격 모션 중 타겟 사망** | 피해 적용 시점에 `target.is_alive`를 재확인한다. DEAD 상태이면 `apply_damage()` 건너뜀. VFX는 `damage_dealt` 시그널이 없으므로 발생 안 함. |
| **동일 프레임 동시 킬** | 두 영웅이 같은 프레임에 같은 적에게 피해를 주어 모두 HP=0으로 만들 경우: 첫 번째 `apply_damage()` 호출이 `current_hp=0`으로 만들고 `unit_died`를 발행. 두 번째 호출은 이미 `is_alive=false`인 타겟을 감지하고 스킵. `unit_died`는 1회만 발행. |
| **오버킬** | `enemy.current_hp = max(0.0, enemy.current_hp - final_damage)`. 음수 HP 불허. 초과 피해는 소멸 (이월 없음). |
| **아머 > final_atk** | `max(1, final_atk - armor)`의 최솟값 보장으로 항상 최소 1 피해. 예: 무사 final_atk=18, armor=20 → effective=max(1, -2)=1. |
| **크리티컬 확률 float 경계** | `randf()`는 [0.0, 1.0) 범위. `base_crit_rate=0.0`이면 절대 크리 없음. `base_crit_rate=1.0`이면 항상 크리. |
| **광역 공격 타겟 없음** | `atk_area > 0`인 영웅이 광역을 실행할 때 타겟 위치 반경에 추가 적이 없으면 주 타겟 1체에만 피해 적용. 정상 동작. |
| **광역 공격 중 타겟 사망** | 광역 루프 시작 전 `area_targets` 배열을 확정한다. 루프 중 중간에 적이 사망해도 이미 배열에 포함된 경우 `apply_damage()` 진입 시 `is_alive` 재확인 후 스킵. |
| **STUNNED 중 공격 타이머** | 공격 루프 자체가 중단되므로 타이머가 차감되지 않는다. STUNNED 해제 후 남은 타이머 기준으로 재개. 스턴 중에도 타이머가 돌아야 하는지는 의도적으로 "돌지 않음"으로 결정 — 스턴은 완전한 제어 상실. |
| **USING_SKILL 중 공격 타이머** | 스킬 발동 중에는 공격 루프가 중단되므로 타이머가 차감되지 않는다. 스킬 종료(USING_SKILL 해제) 후 타이머 재개. 스킬 사용이 공격 주기를 초기화하지 않는다. |
| **float 정밀도** | `final_atk`는 float 유지. 피해 적용 직전 `floor()`로 int 변환. 이 지점이 유일한 int 변환 포인트. |
| **타겟이 DEAD 상태로 target 변수에 남아있음** | 매 공격 타이머 만료마다 타겟을 새로 선택한다 (재사용 없음). DEAD 적은 `_get_enemies_in_range()` 조회에서 제외된다 (`is_alive == false` 필터링). |

---

## Dependencies

### 이 시스템이 의존하는 시스템 (Upstream)

| 시스템 | 방향 | 의존 내용 |
|--------|------|----------|
| **Unit Base** | Combat → UnitBase | `HeroUnit.final_atk`, `HeroUnit.final_atk_speed`, `HeroUnit.final_range`, `HeroUnit.slot_position`, `HeroUnit.state`, `HeroUnit.active_buffs` 읽기; `EnemyUnit.current_hp` 차감, `EnemyUnit.armor`, `EnemyUnit.magic_resist` 읽기, `EnemyUnit.distance_traveled` 읽기, `EnemyUnit.transition_to(DEAD)` 호출 |
| **Data Config** | Combat → DataManager | 영웅 인스턴스 생성 시 `get_hero()` → `base_crit_rate`, `base_crit_damage`, `atk_type`, `atk_area` 로드. 전투 중 실시간 호출 없음. |

### 이 시스템에 의존하는 시스템 (Downstream)

| 시스템 | 방향 | 의존 내용 |
|--------|------|----------|
| **Wave Defense** | WaveDefense → Combat | `unit_died` 시그널 구독 → 적 사망 처리, `reward_gold` 지급, 웨이브 진행 체크 |
| **VFX/파티클** | VFX → Combat | `damage_dealt(attacker, target, damage, is_crit, damage_type)` 시그널 구독 → 피격 이펙트, 크리티컬 이펙트 재생 |
| **Battle HUD** | HUD → Combat | `damage_dealt` 시그널 구독 → 플로팅 데미지 숫자 생성; `EnemyUnit.current_hp` 폴링 또는 HP 변경 시그널로 HP 바 갱신 |
| **Skill Activation** | Skill → Combat | 스킬 피해 계산 시 동일 `_apply_damage_to()` 함수 재사용. 스킬 피해는 `damage_type`을 오버라이드 가능 (예: 물리 영웅의 마법 스킬). |

### 시그널 계약

Combat 시스템이 발행하는 시그널:

```gdscript
# 피해 적용 완료 (HP 차감 후 발행)
signal damage_dealt(attacker: HeroUnit, target: EnemyUnit, damage: int, is_crit: bool, damage_type: String)

# EnemyUnit.unit_died 를 relay (Wave Defense가 직접 EnemyUnit 시그널을 구독해도 무방)
# → unit_died는 EnemyUnit 자체에서 발행 (Unit Base 소유). Combat은 relay 없이 직접 호출만 함.
```

---

## Tuning Knobs

| Parameter | 위치 | Current MVP | Safe Range | 조정 효과 |
|-----------|------|-------------|------------|----------|
| `base_crit_rate` (영웅별) | heroes.json | 0.05 ~ 0.20 | 0.0 ~ 0.35 | 높이면 예측 불가 버스트 증가, 낮추면 안정적 DPS |
| `base_crit_damage` (영웅별) | heroes.json | 1.5 ~ 2.0× | 1.2 ~ 3.0× | 크리 발생 시 느껴지는 "터짐" 강도 |
| `atk_area` (영웅별) | heroes.json | 0 or 40px | 0 ~ 80px | 넓히면 광역 효율 증가, 좁히면 단일 집중 |
| `armor` (적별) | enemies.json | 0 ~ 10 | 0 ~ 30 | 높이면 물리 영웅 효율 저하, 마법 영웅 가치 상승 |
| `magic_resist` (적별) | enemies.json | 0 ~ 5 | 0 ~ 20 | 높이면 마법 영웅 효율 저하, 물리 영웅 가치 상승 |
| `MIN_EFFECTIVE_DAMAGE` | CombatSystem 상수 | 1 | 0 ~ 5 | 0이면 완전 무효화 가능; 5면 고아머 적 의미 약화 |
| `FLOATING_TEXT_POOL_SIZE` | HUD 상수 | 20 | 10 ~ 40 | 너무 낮으면 숫자 재활용 시 튀는 현상 |
| `FLOATING_TEXT_DURATION` | HUD 상수 | 0.8초 | 0.5 ~ 1.5초 | 낮추면 빠른 전투감, 높이면 피해 인지 시간 증가 |
| `CRIT_POP_SCALE` | HUD 상수 | 1.3× | 1.1 ~ 1.5× | 크리티컬 숫자 팝 애니메이션 강도 |
| `CRIT_POP_DURATION` | HUD 상수 | 0.2초 | 0.1 ~ 0.4초 | 크리티컬 팝 지속 시간 |

**밸런스 경고**: `armor`와 `magic_resist`가 너무 높으면 특정 영웅이 완전히 쓸모없어진다.
`min(armor, hero.final_atk × 0.8)`을 초과하지 않도록 권장.
즉, 어떤 적의 아머도 해당 영웅 `final_atk`의 80%를 넘지 않아야 한다.

---

## Acceptance Criteria

### 기본 공격 사이클

- [ ] 사거리 내 적이 있을 때 영웅이 ATTACKING 상태로 전환된다
- [ ] 사거리 내 적이 없을 때 영웅이 IDLE 상태를 유지한다
- [ ] 공격 타이머 만료 시 정확히 1회 `_execute_attack()`이 호출된다
- [ ] 궁수 (`atk_speed=1.5`)는 1초에 1.5회, 도사 (`atk_speed=0.8`)는 1초에 0.8회 공격한다 (±5% 허용)
- [ ] STUNNED 상태에서 공격이 실행되지 않는다
- [ ] USING_SKILL 상태에서 공격이 실행되지 않는다

### 타겟 선택

- [ ] 사거리 내 여러 적 중 `distance_traveled`가 가장 큰 적이 선택된다
- [ ] 선택된 타겟이 사망하면 다음 공격에서 새 타겟이 선택된다
- [ ] 타겟 선택 시 DEAD 상태의 적은 후보에 포함되지 않는다

### 물리 피해 계산

- [ ] 무사 +7 (`final_atk=62`) vs 돌 트롤 (`armor=5`): `effective_damage = 57`
- [ ] 어떤 영웅/적 조합에서도 `effective_damage < 1`이 되지 않는다
- [ ] `armor > final_atk`인 경우 `effective_damage = 1`
- [ ] 무사의 기본 공격이 `atk_type="physical"`이고 `enemy.armor`를 사용한다

### 마법 피해 계산

- [ ] 도사 (`atk_type="magical"`)의 기본 공격이 `enemy.magic_resist`를 사용한다
- [ ] 물리 영웅(`atk_type="physical"`)은 `enemy.magic_resist`를 사용하지 않는다
- [ ] 마법 피해도 최소 1 보장

### 크리티컬 히트

- [ ] 궁수 (`base_crit_rate=0.20`) 1000회 공격 시 크리티컬 비율이 20% ± 3% 범위에 있다 (통계 테스트)
- [ ] 크리티컬 발생 시 `final_damage = floor(effective_damage × base_crit_damage)`
- [ ] 궁수 크리티컬: `effective_damage × 2.0`, 무사 크리티컬: `effective_damage × 1.5`
- [ ] `damage_dealt` 시그널의 `is_crit` 플래그가 실제 크리티컬 발생 여부와 일치한다
- [ ] `base_crit_rate=0.0`인 영웅은 크리티컬이 발생하지 않는다

### 광역 공격

- [ ] 도사 (`atk_area=40px`) 공격 시 타겟 중심 40px 내 모든 적에게 피해가 적용된다
- [ ] 광역 범위 밖의 적은 피해를 받지 않는다
- [ ] 광역 공격 시 `is_crit`이 모든 타겟에 동일하게 적용된다 (타겟별 독립 판정 없음)

### 피해 이벤트

- [ ] 피해 적용 후 `damage_dealt` 시그널이 1회 발행된다
- [ ] 시그널의 `damage` 값이 실제 차감된 HP와 일치한다
- [ ] 광역 공격 시 타겟당 1회씩 `damage_dealt`가 발행된다
- [ ] 이미 DEAD인 적에게 `damage_dealt`가 발행되지 않는다

### 적 사망 처리

- [ ] `current_hp`가 0 이하가 되면 `EnemyUnit.transition_to(DEAD)` 가 호출된다
- [ ] `unit_died` 시그널이 정확히 1회 발행된다 (동시 킬 포함)
- [ ] `current_hp`가 음수가 되지 않는다
- [ ] 오버킬 피해는 `current_hp = 0`으로 처리되고 이월되지 않는다

### 플로팅 데미지 숫자

- [ ] 크리티컬 숫자는 일반 숫자보다 크고 다른 색상으로 표시된다
- [ ] 물리 크리티컬은 빨간색(`#FF3333`), 마법 크리티컬은 보라색(`#CC44FF`)
- [ ] 동시에 20개 초과 플로팅 텍스트가 생성되지 않는다 (풀 제한)
- [ ] `damage_dealt` 없이 플로팅 숫자가 생성되지 않는다
