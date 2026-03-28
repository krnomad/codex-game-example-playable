# 스킬 발동 (Skill Activation)

> **Status**: Designed
> **Author**: systems-designer + user
> **Last Updated**: 2026-03-28
> **Implements Pillar**: 플레이어 주도 전황 역전 (영웅 액티브 스킬, 타이밍 선택)

---

## Overview

풍운지기의 스킬 발동 시스템은 플레이어가 전투 중 영웅별 액티브 스킬을 직접 눌러
전황을 뒤집는 순간을 담당한다. 각 영웅은 정확히 1개의 액티브 스킬을 가지며,
Battle HUD의 스킬 버튼 입력을 받아 `SkillActivationSystem`이 발동 조건을 검증하고,
HeroUnit을 `USING_SKILL` 상태로 전환한 뒤 효과를 적용한다.

이 시스템은 자동 공격만으로는 만들기 어려운 "지금 눌러야 산다"는 긴장감을 제공한다.
평소에는 Combat 시스템이 영웅의 지속 화력을 담당하고, 위기 순간에는 Skill Activation
시스템이 폭발 피해, 버프, 광역 디버프 같은 고점 행동을 추가해 플레이어 숙련도를
표현하게 만든다.

---

## Player Fantasy

> "오우거가 마지막 코너를 돈다. 그냥 두면 목숨이 깎인다.
> 나는 +7 무사의 스킬 버튼을 누른다.
> 금빛 잔상이 번쩍이고, 무사가 칼을 휘두른다. 경로 위 적들이 한 번에 쓸려나간다.
> 바로 이어서 무녀의 결계를 켠다. 남은 적들이 느려지고, 궁수의 만궁술이 켜진다.
> 웨이브가 무너지지 않고 버텨진다. 이건 자동 전투가 아니라 내가 살린 판이다."

플레이어가 원하는 감각:
- **내가 개입했다는 확신**: 스킬 버튼을 누른 타이밍이 생존과 직결된다
- **영웅 개성의 선명함**: 무사는 폭발, 궁수는 버프, 도사는 연쇄 번개, 무녀는 광역 약화
- **명확한 가독성**: 스킬이 준비됐는지, 언제 쓸 수 있는지, 누구에게 먹혔는지가 즉시 보인다
- **모바일 친화적 조작**: 정밀 타게팅 없이 한 번 탭으로 발동 가능하다

---

## Detailed Design

### 시스템 역할

`SkillActivationSystem`은 스테이지 씬의 로컬 싱글턴으로 존재한다.
Autoload로 두지 않는 이유는 스킬 상태가 현재 전투 씬에만 귀속되기 때문이다.

**파일 위치**: `src/gameplay/skill_activation_system.gd`

핵심 책임:
- Battle HUD의 스킬 버튼 입력 수신
- 발동 가능 여부 검증
- 캐스트 시작/완료 및 쿨다운 관리
- 즉시 피해, 버프, 디버프 효과 적용
- VFX, Audio, Battle HUD가 소비할 시그널 발행

### MVP 스킬 모델

MVP 규칙은 단순하게 고정한다.

- 각 영웅은 **액티브 스킬 1개**만 가진다
- 스킬은 **플레이어 수동 발동**만 지원한다
- 마나/에너지 자원 없음. 제약은 **쿨다운만** 사용
- 모든 스킬은 **원탭 비지정형(non-targeted)** 이다
- 세부 타겟 선택은 SkillActivationSystem이 자동으로 처리한다

즉, 플레이어의 숙련도는 "어디를 눌렀는가"보다 "언제 눌렀는가"에 집중된다.

---

### 발동 가능 조건

Battle HUD 또는 입력 계층에서 `request_skill_cast(hero: HeroUnit)`을 호출하면
아래 조건을 순서대로 검사한다.

```gdscript
func request_skill_cast(hero: HeroUnit) -> bool:
    if hero == null:
        return false
    if _stage_state != StageState.WAVES:
        return false
    if _wave_state != WaveState.SPAWNING and _wave_state != WaveState.ACTIVE:
        return false
    if hero.slot_id == "":
        return false
    if hero.state == UnitState.STUNNED or hero.state == UnitState.USING_SKILL:
        return false
    if hero.skill_cooldown_remaining > 0.0:
        return false
    if not _has_valid_targets_if_required(hero):
        return false
    return _begin_skill_cast(hero)
```

#### 타겟 필요 여부

| 스킬 유형 | 타겟 필요 여부 | 실패 조건 |
|-----------|---------------|----------|
| 즉시 피해형 (`BURST_SELF`, `CHAIN_LIGHTNING`) | 필요 | 사거리/영역 내 유효 적이 0 |
| 버프형 (`SELF_BUFF`) | 불필요 | 없음 |
| 광역 디버프형 (`GLOBAL_DEBUFF`) | 불필요 | 없음 |

> **설계 결정**: 유효 타겟이 필요한 스킬은 발동 직전 미리 막는다.
> 플레이어가 쿨다운을 낭비했다고 느끼는 상황을 줄이기 위함이다.

---

### 캐스트 수명주기

영웅별 스킬은 아래 상태 흐름을 따른다.

```
READY
  │  (스킬 버튼 입력)
  ▼
CASTING
  │  cast_time 경과
  ▼
EFFECT_APPLY
  │
  ├─ 지속 효과 없음 ──▶ COOLDOWN
  └─ 지속 효과 있음 ──▶ ACTIVE_EFFECT ── 종료 시 COOLDOWN
                              │
                              ▼
                           COOLDOWN
                              │
                              ▼
                            READY
```

구현상 별도 enum을 HeroUnit에 추가하지는 않는다.
영웅의 주 상태는 `USING_SKILL` / `ATTACKING` / `IDLE`을 유지하고,
지속형 효과는 `active_buffs` 또는 시스템 레지스트리로 관리한다.

#### 캐스트 시작

스킬이 시작되면:

1. `hero.transition_to(UnitState.USING_SKILL)` 호출
2. 현재 `hero.slot_position`을 `skill_origin_position`으로 스냅샷
3. `skill_cast_started(hero, skill_id)` 시그널 발행
4. `cast_time`만큼의 연출 지연 후 효과 적용

#### 효과 적용 후 처리

효과 적용이 끝나면:

1. `hero.skill_cooldown_remaining = hero.final_skill_cooldown`
2. `hero.attack_timer = 1.0 / hero.final_atk_speed`
3. 유효 적이 있으면 `ATTACKING`, 없으면 `IDLE`로 복귀
4. `skill_cooldown_started(hero, skill_id, duration)` 시그널 발행
5. `skill_cast_finished(hero, skill_id)` 시그널 발행

> **설계 결정**: 스킬 사용 후 일반 공격 타이머는 완전히 리셋한다.
> 스킬 버튼으로 공격 모션을 캔슬해 DPS를 비정상적으로 끌어올리는 행동을 막는다.

---

### 배치 시스템과의 상호작용

Placement GDD에서 이미 정의한 대로, 전투 중 재배치는 허용된다.
단, 스킬 도중 위치가 바뀌는 경우 현재 캐스트는 시작 시점 기준으로 고정한다.

#### 위치 스냅샷 규칙

- 스킬 시작 시 `skill_origin_position = hero.slot_position`
- 현재 캐스트의 범위 판정, 방향, VFX 기준점은 `skill_origin_position`을 사용
- 캐스트 중 플레이어가 영웅을 다른 슬롯으로 옮기면 `hero.slot_position`은 즉시 갱신됨
- 하지만 **현재 스킬 모션/판정은 기존 위치에서 끝까지 완료**
- 캐스트 종료 직후 시각 위치를 새 `slot_position`으로 동기화

이 규칙으로 "눌렀더니 엉뚱한 위치에서 터짐"과 "이동하면서 스킬 범위를 늘리는 악용"을 동시에 방지한다.

---

### 쿨다운 규칙

스킬 쿨다운은 heroes.json의 `base_skill_cooldown`을 출발점으로 삼고,
강화 배율이 반영된 `hero.final_skill_cooldown`을 실제 사용값으로 쓴다.

```
final_skill_cooldown =
    max(1.0, base_skill_cooldown * (1.0 - cooldown_reduction))
```

쿨다운은 `SkillActivationSystem._process(delta)`에서 감소시킨다.

```gdscript
for hero in _tracked_heroes:
    hero.skill_cooldown_remaining = max(0.0, hero.skill_cooldown_remaining - delta)
```

#### 중첩 규칙

- 같은 영웅은 쿨다운이 끝나기 전까지 재사용 불가
- 지속형 효과가 아직 남아 있어도 쿨다운이 끝나지 않았으면 재사용 불가
- 버프 지속 시간보다 쿨다운이 항상 길도록 밸런싱한다

---

### 타겟팅 규칙

모든 스킬은 UI 상으로는 비지정형이지만, 내부적으로는 자동 타겟팅 규칙을 가진다.

#### 공통 규칙

- 적 대상 선택은 Combat GDD의 기본 규칙을 재사용한다
- 단일 기준 타겟이 필요하면 **Furthest Along Path** 우선순위를 사용한다
- 스킬이 범위형이면 기준점 또는 기준 타겟을 먼저 고른 뒤 추가 대상 확장

#### 스킬별 타겟 기준

| 스킬 | 기준점/기준 타겟 |
|------|----------------|
| 질풍참 | `skill_origin_position` 중심 원형 범위 |
| 만궁술 | 자기 자신 |
| 뇌전술 | 사거리 내 furthest target 1체를 시작점으로 체인 확장 |
| 결계 | 현재 적 전체 + 지속 시간 중 새로 스폰된 적 |

---

### skills.json 스키마

스킬 고유 파라미터는 `skills.json`에 저장한다.
쿨다운은 영웅 기본 스탯에 남겨 강화와의 연결을 단순하게 유지한다.

```json
{
  "meta": {
    "version": "1.0.0",
    "last_updated": "2026-03-28",
    "description": "영웅 액티브 스킬 정의"
  },
  "skills": {
    "musa_blade_storm": {
      "id": "musa_blade_storm",
      "hero_id": "musa",
      "name_ko": "질풍참",
      "effect_type": "BURST_SELF",
      "cast_time": 0.35,
      "target_mode": "SELF_AREA",
      "effect_params": {
        "radius": 120,
        "damage_multiplier": 3.0,
        "damage_type": "physical",
        "can_crit": false
      }
    }
  }
}
```

#### 필수 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | String | 스킬 ID |
| `hero_id` | String | 소유 영웅 ID |
| `name_ko` | String | 표시 이름 |
| `effect_type` | String | `BURST_SELF` / `SELF_BUFF` / `CHAIN_LIGHTNING` / `GLOBAL_DEBUFF` |
| `cast_time` | float | 버튼 입력 후 실제 효과 적용까지 시간 |
| `target_mode` | String | `SELF_AREA` / `SELF` / `AUTO_ENEMY_CHAIN` / `GLOBAL_ENEMY` |
| `effect_params` | Dictionary | 효과별 상세 파라미터 |

---

### MVP 영웅별 스킬 정의

#### 1. 무사 — 질풍참 (`musa_blade_storm`)

- 유형: `BURST_SELF`
- 캐스트 시간: `0.35s`
- 범위: 영웅 기준 반경 `120px`
- 피해: `hero.final_atk × 3.0`
- 피해 유형: `physical`
- 크리티컬: 없음

적용 규칙:

```gdscript
var targets = _get_enemies_in_radius(skill_origin_position, 120.0)
for enemy in targets:
    var damage = _calculate_skill_damage(hero, enemy, 3.0, "physical", false)
    enemy.apply_damage(damage)
```

의도:
- 코너 슬롯에서 적이 뭉쳤을 때 눌러 광역 압박을 해소
- 무사의 "근접 폭발력" 정체성을 강화

#### 2. 궁수 — 만궁술 (`gungsu_rain_of_arrows`)

- 유형: `SELF_BUFF`
- 캐스트 시간: `0.20s`
- 지속 시간: `4.0s`
- 효과: 공격 속도 `×3.0`
- 적용 대상: 자기 자신

적용 규칙:

```gdscript
hero.active_buffs.append({
    "type": "ATK_SPEED_MULT",
    "value": 3.0,
    "duration_remaining": 4.0,
    "source": "gungsu_rain_of_arrows"
})
```

의도:
- 보스나 고체력 적 구간에서 순간 화력 창출
- 단순 피해 스킬이 아니라 "타이밍형 버프" 역할을 부여

#### 3. 도사 — 뇌전술 (`dosa_thunder_talisman`)

- 유형: `CHAIN_LIGHTNING`
- 캐스트 시간: `0.45s`
- 시작 타겟: 사거리 내 furthest target
- 최대 타겟 수: `5`
- 점프 반경: `90px`
- 피해: 각 타겟에 `hero.final_atk × 4.0`
- 피해 유형: `magical`
- 크리티컬: 없음

적용 규칙:

1. 시작 타겟 1체 선택
2. 아직 맞지 않은 적 중 가장 가까운 적으로 연쇄
3. 최대 5체 또는 점프 가능한 적이 없을 때 종료

> **설계 결정**: 체인 번개 피해량은 감쇠시키지 않는다.
> MVP에서는 읽기 쉬운 강한 버튼으로 유지하고, 감쇠는 post-MVP 튜닝 항목으로 둔다.

#### 4. 무녀 — 결계 (`munyeo_spirit_blessing`)

- 유형: `GLOBAL_DEBUFF`
- 캐스트 시간: `0.25s`
- 지속 시간: `5.0s`
- 효과: 이동 속도 `-60%`
- 적용 대상: 현재 적 전체 + 지속 시간 중 새로 스폰된 적

적용 규칙:

- 현재 살아 있는 모든 적에게 슬로우 디버프 적용
- 시스템에 `global_enemy_modifiers` 레지스트리를 만들어 남은 시간을 추적
- 지속 시간 동안 스폰되는 적은 생성 직후 동일 디버프 부여
- Enemy Path GDD의 규칙대로 슬로우는 **곱셈 합성**되고 `SLOW_CAP = 0.75`를 초과할 수 없다

의도:
- 위기 완화형 전체 제어 스킬
- 보스 포함 전체 웨이브의 템포를 한 번 늦춰주는 안전판

---

### 피해 계산 규칙

피해형 스킬은 Combat 시스템의 방어 처리 공식을 그대로 재사용한다.
차이는 일반 공격이 아니라 스킬 배율을 먼저 곱한다는 점뿐이다.

```
raw_damage = hero.final_atk * skill_damage_multiplier
reduced_damage = raw_damage - defense_stat
effective_damage = max(1, reduced_damage)
final_damage = floor(effective_damage)
```

MVP 기본 규칙:

- 스킬 피해는 `can_crit`가 `false`이면 크리티컬 없음
- 방어 스탯은 `damage_type`에 따라 `armor` 또는 `magic_resist`
- 스킬 킬도 일반 킬과 동일하게 `unit_died`를 발생시키며 Wave Defense 보상 흐름에 합류

---

### 시그널 계약

SkillActivationSystem은 아래 시그널을 외부 시스템에 제공한다.

```gdscript
signal skill_cast_started(hero: HeroUnit, skill_id: String)
signal skill_effect_applied(hero: HeroUnit, skill_id: String, targets: Array)
signal skill_cast_failed(hero: HeroUnit, skill_id: String, reason: String)
signal skill_cooldown_started(hero: HeroUnit, skill_id: String, duration: float)
signal skill_cast_finished(hero: HeroUnit, skill_id: String)
```

사용처:

- **Battle HUD**: 버튼 비활성화, 쿨다운 오버레이, 실패 안내
- **VFX/파티클**: 캐스트 원, 번개 체인, 결계 오라
- **Audio/SFX**: 스킬 고유 발동음
- **Wave Defense**: 보스 웨이브 연출과 겹치는 타이밍 조정 시 참고 가능

---

### 다른 시스템과의 상호작용

| 시스템 | 방향 | 연동 내용 |
|--------|------|----------|
| **Battle HUD** | HUD → Skill | 버튼 입력으로 `request_skill_cast()` 호출 |
| **Unit Base** | Skill ↔ Unit | `USING_SKILL` 상태 전환, `active_buffs`, `skill_cooldown_remaining` 사용 |
| **Combat** | Skill → Combat | 피해 계산식 재사용, 자동 타겟 선택 규칙 공유 |
| **Placement** | Placement ↔ Skill | `slot_position` 사용, 캐스트 중 위치 변경 스냅샷 처리 |
| **Enemy Path/AI** | Skill → Enemy | 결계 슬로우 디버프 적용 |
| **Wave Defense** | Wave → Skill | WAVES/SPAWNING/ACTIVE 단계에서만 사용 허용 |
| **Data Config** | Skill → Data | `skills.json` 및 `hero.skill_id` 조회 |
| **VFX/Audio** | Skill → Presentation | 캐스트 시작/적용 시그널 발행 |

---

## Edge Cases

| 상황 | 처리 |
|------|------|
| 플레이스먼트 단계에서 스킬 버튼 탭 | 무시. `skill_cast_failed(..., "wrong_phase")` |
| 영웅이 기절 중일 때 스킬 시도 | 무시. 쿨다운 소모 없음 |
| 피해형 스킬 직전엔 타겟이 있었는데 캐스트 순간 모두 죽음 | 캐스트는 진행되지만 적용 시점에 유효 대상이 없으면 빈 타격으로 종료. 쿨다운은 소모됨 |
| 스킬 캐스트 중 영웅 재배치 | 현재 캐스트는 시작 위치 기준으로 완료, 종료 후 새 슬롯으로 동기화 |
| 결계 지속 중 새 웨이브 적 스폰 | 남은 지속 시간 동안 동일 슬로우 부여 |
| Victory/Defeat로 스테이지 종료 | 남은 캐스트 타이머와 지속 효과 모두 정리. 다음 씬으로 상태 누출 없음 |
| 버튼 연타 | `USING_SKILL` 또는 쿨다운 조건에서 즉시 차단 |

---

## Tuning Knobs

| 파라미터 | 현재 값 | 안전 범위 | 영향 |
|---------|--------|----------|------|
| `musa.radius` | 120px | 90~150px | 높을수록 코너 슬롯 지배력 증가 |
| `musa.damage_multiplier` | 3.0 | 2.0~4.0 | 군중 제어와 순간 삭제력 조정 |
| `gungsu.atk_speed_mult` | 3.0 | 2.0~3.5 | 보스 화력 상승폭 조정 |
| `gungsu.duration` | 4.0s | 2.5~5.0s | 버스트 유지 시간 조정 |
| `dosa.max_targets` | 5 | 3~7 | 다수전 청소 능력 조정 |
| `dosa.jump_radius` | 90px | 70~120px | 적 밀집도 의존성 조정 |
| `munyeo.slow_ratio` | 0.60 | 0.35~0.60 | 생존 안정성에 직접 영향 |
| `munyeo.duration` | 5.0s | 3.0~6.0s | 전체 웨이브 템포 완화 정도 조정 |

---

## Acceptance Criteria

- [ ] 배치된 영웅마다 Battle HUD에 스킬 버튼 1개가 표시된다
- [ ] 스킬은 WAVES 상태의 SPAWNING/ACTIVE에서만 발동된다
- [ ] 스킬 발동 시 해당 영웅이 `USING_SKILL` 상태로 진입한다
- [ ] 스킬 종료 후 쿨다운이 시작되고 버튼에 남은 시간이 표시된다
- [ ] 질풍참은 영웅 주변 범위 피해를 준다
- [ ] 만궁술은 4초간 자기 공격 속도를 3배로 만든다
- [ ] 뇌전술은 최대 5체에 연쇄 마법 피해를 준다
- [ ] 결계는 현재 적과 새로 스폰되는 적 모두를 5초간 감속시킨다
- [ ] 스킬 도중 재배치해도 현재 캐스트 판정은 시작 위치 기준으로 유지된다
- [ ] 스킬 킬은 일반 공격 킬과 동일하게 웨이브 보상 흐름에 합류한다
