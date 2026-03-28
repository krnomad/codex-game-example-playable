# 유닛 기반 (Unit Base)

> **Status**: Designed
> **Author**: systems-designer + user
> **Last Updated**: 2026-03-28
> **Implements Pillar**: 전체 (모든 전투/배치/VFX의 공통 기반)

---

## Overview

영웅(HeroUnit)과 적(EnemyUnit)이 공유하는 공통 데이터 구조와 런타임 상태 기계를
정의하는 인프라 시스템이다. 모든 전투 판정, 경로 이동, 스킬 발동, VFX 연동은
이 시스템이 제공하는 인터페이스를 통해 동작한다. 영웅은 슬롯에 고정 배치되어
적을 공격하고, 적은 정해진 경로를 따라 이동하며 목표 지점에 도달하려 한다.
강화 배율은 영웅 인스턴스 생성 시점에 적용되며, 전투 중에는 불변으로 유지된다.

## Player Fantasy

이 시스템은 **개발 인프라**다. 플레이어가 직접 인식하지 않지만, 이 시스템이
견고해야 "무사가 요괴를 정확히 사거리 내에서 타격하고, 궁수의 강화된 화살이
아머를 꿰뚫는" 모든 장면이 정확하게 작동한다.

**디자이너/개발자 판타지**: "새 영웅이나 새 적을 추가할 때 BaseUnit을 상속받고
JSON에 스탯을 정의하면 전투/VFX/AI가 자동으로 연동된다."

---

## Detailed Design

### Core Rules

#### 공통 베이스 구조 (BaseUnit)

모든 유닛은 `BaseUnit`(Node2D 상속)을 상속한다.

```gdscript
class_name BaseUnit
extends Node2D

# 식별자
var unit_id: String          # DataManager ID ("musa", "fire_oni")
var unit_type: UnitType      # HERO or ENEMY

# 런타임 스탯 (계산 완료된 최종값)
var final_atk: float
var final_atk_speed: float
var final_range: float
var final_skill_cooldown: float

# 상태
var state: UnitState
var is_alive: bool

# 위치
var world_position: Vector2

# 시그널
signal state_changed(old_state: UnitState, new_state: UnitState)
signal unit_died(unit: BaseUnit)
```

**열거형**:

```gdscript
enum UnitType { HERO, ENEMY }

enum UnitState {
    IDLE,           # 대기
    ATTACKING,      # 공격 모션 중
    USING_SKILL,    # 스킬 발동 중
    STUNNED,        # 기절 (이동/공격 불가)
    DEAD            # 사망 (적 전용)
}
```

**공유 인터페이스**:

```gdscript
func initialize(data: Dictionary) -> void      # 생성 직후 데이터 로드
func recalculate_stats() -> void               # 스탯 재계산
func transition_to(new_state: UnitState) -> bool  # 상태 전환
func get_vfx_anchor() -> Vector2               # 파티클 부착점
func is_in_range(target_position: Vector2) -> bool  # 사거리 판정
```

#### HeroUnit (영웅 유닛)

```gdscript
class_name HeroUnit
extends BaseUnit

# 기본 스탯 (heroes.json)
var base_atk: float
var base_atk_speed: float
var base_range: float
var base_skill_cooldown: float

# 강화 배율 (enhancement.json)
var enhancement_level: int      # +0 ~ +10
var atk_multiplier: float
var range_multiplier: float
var cooldown_reduction: float

# 배치 정보
var slot_id: String
var slot_position: Vector2      # 배치 시 고정, 전투 중 불변

# 스킬
var skill_id: String
var skill_cooldown_remaining: float

# 공격 타이머
var attack_timer: float

# 버프 (메타 상태, 주 상태와 병행)
var active_buffs: Array[Dictionary]  # [{type, value, duration_remaining}]
```

영웅은 `DEAD` 상태가 없다. 전투 종료 후 Placement 시스템이 슬롯에서 회수.

#### EnemyUnit (적 유닛)

```gdscript
class_name EnemyUnit
extends BaseUnit

# 적 스탯 (enemies.json)
var max_hp: float
var current_hp: float
var armor: float
var move_speed: float
var reward_gold: int

# 경로 이동
var path_points: Array[Vector2]   # Wave Defense가 주입
var path_index: int
var distance_traveled: float      # 우선순위 계산용

# 유형/특수 능력
var enemy_type: String            # "NORMAL" / "ELITE" / "BOSS"
var abilities: Array[String]
var ability_params: Dictionary

# 보스 전용
var boss_phase: int
var boss_phase_thresholds: Array[float]
```

> **설계 결정**: 적의 이동은 `_physics_process`에서 항상 실행. 별도 MOVING 상태 없음.
> 상태 머신은 "이동을 멈추는 조건(STUNNED, DEAD)"만 제어.

#### 런타임 스탯 계산

인스턴스 생성 시 **1회** 계산, 전투 중 불변:

```gdscript
func recalculate_stats() -> void:
    var enh = DataManager.get_enhancement_level(enhancement_level)
    final_atk            = base_atk * enh["atk_multiplier"]
    final_atk_speed      = base_atk_speed  # 현재 배율 없음
    final_range          = base_range * enh["range_multiplier"]
    final_skill_cooldown = max(1.0, base_skill_cooldown * (1.0 - enh["cooldown_reduction"]))
    _apply_active_buffs()
```

#### DataManager 참조 규약

- `initialize()` 시점에 **한 번만** DataManager 호출, 이후 프레임마다 쿼리하지 않음
- 조회 결과를 인스턴스 변수에 캐시
- 빈 딕셔너리 반환 시 `push_error()` + 안전 기본값 (`final_atk=1.0`, `final_range=50.0`)

#### 위치 처리

| 유형 | 위치 결정자 | 변경 빈도 |
|------|------------|----------|
| 영웅 | Placement 시스템 (슬롯 좌표) | 배치 1회, 전투 중 불변 |
| 적 | Enemy Path/AI (`_physics_process`) | 매 프레임 |

```gdscript
func get_vfx_anchor() -> Vector2:
    return global_position + Vector2(0, -8)  # 스프라이트 중심 8px 위
```

### States and Transitions

#### 영웅 상태 전환도

```
[IDLE] ──── 적 감지 ────▶ [ATTACKING]
  ▲                           │ 적 없어짐
  └───────────────────────────┘

[ATTACKING] ── 스킬 준비 ──▶ [USING_SKILL] ──▶ [ATTACKING/IDLE]

[모든 상태] ── 기절 ──▶ [STUNNED] ── 타이머 만료 ──▶ 이전 상태
```

- BUFFED는 별도 상태가 아닌 **메타 상태** (`active_buffs` 배열로 관리)
- BUFFED는 IDLE, ATTACKING, USING_SKILL과 병행 가능

#### 적 상태 전환도

```
[IDLE] ── 경로 시작 ──▶ [이동 중] ── HP=0 ──▶ [DEAD] ──▶ queue_free()
                           │
                           └── 기절 ──▶ [STUNNED] ── 만료 ──▶ [이동 중]
                           │
                           └── 목표 도달 ──▶ reached_goal 시그널 ──▶ 제거
```

#### 유닛 생명주기

**영웅**: 생성 → Placement가 slot 주입 → initialize() → recalculate_stats() → 전투 → 전투 종료 후 회수

**적**: 생성 → Wave Defense가 path 주입 → initialize() → 경로 이동 → 사망 또는 목표 도달 → queue_free()

### Interactions with Other Systems

| 시스템 | 방향 | 연동 내용 |
|--------|------|----------|
| **DataManager** | Unit → DM | `initialize()` 시 `get_hero()`/`get_enemy()` 1회 호출 |
| **전투/데미지** | Combat → Unit | `final_atk`, `armor` 읽기, `current_hp` 차감 |
| **강화 시스템** | Enhancement → HeroUnit | `enhancement_level` 설정 (전투 외부만) |
| **VFX/파티클** | VFX → Unit | `get_vfx_anchor()`, `state_changed`/`unit_died` 시그널 구독 |
| **스킬 발동** | Skill ↔ Unit | `USING_SKILL` 상태 전환, 쿨다운 읽기 |
| **웨이브 방어** | Wave → EnemyUnit | `path_points` 주입, `unit_died`/`reached_goal` 구독 |
| **타워 배치** | Placement → HeroUnit | `slot_id`/`slot_position` 주입, 생성/회수 |

---

## Formulas

### 영웅 최종 스탯

```
final_atk            = base_atk × atk_multiplier[enhancement_level]
final_range          = base_range × range_multiplier[enhancement_level]
final_skill_cooldown = max(1.0, base_skill_cooldown × (1.0 - cooldown_reduction[enhancement_level]))
```

| 변수 | 출처 | 범위 |
|------|------|------|
| `base_atk` | heroes.json | 18 ~ 40 |
| `atk_multiplier` | enhancement.json | 1.00 ~ 2.40 |
| `final_atk` | 계산 결과 | 18.0 ~ 96.0 |
| `base_range` | heroes.json | 80 ~ 200 px |
| `range_multiplier` | enhancement.json | 1.00 ~ 1.25 |
| `final_range` | 계산 결과 | 80 ~ 250 px |
| `base_skill_cooldown` | heroes.json | 8.0 ~ 15.0 s |
| `cooldown_reduction` | enhancement.json | 0.00 ~ 0.25 |
| `final_skill_cooldown` | 계산 결과 | 6.0 ~ 15.0 s (최소 1.0s) |

### 유효 데미지 (Combat 시스템이 사용)

```
effective_damage = max(1, final_atk - enemy.armor)
```

**예시 — 무사(atk 40) +7 vs 돌 트롤(armor 5)**:
- final_atk = 40 × 1.55 = 62.0
- effective_damage = max(1, 62.0 - 5) = 57.0

### 사거리 판정

```
in_range = hero.world_position.distance_to(enemy.world_position) <= hero.final_range
```

### 공격 타이머

```
attack_interval = 1.0 / final_atk_speed
```

| 변수 | 범위 |
|------|------|
| `final_atk_speed` | 0.8 ~ 1.5 |
| `attack_interval` | 0.67 ~ 1.25 초 |

---

## Edge Cases

| 상황 | 처리 |
|------|------|
| 전투 중 강화 레벨 변경 시도 | 불가. 강화 UI는 전투 씬 활성화 중 접근 불가. 로비에서만 가능 |
| 버프가 공격 모션 도중 만료 | 현재 공격은 만료 전 스탯으로 완료. 다음 공격부터 버프 없는 스탯 적용 |
| STUNNED 중 스킬 쿨다운 완료 | 쿨다운 타이머는 STUNNED 중에도 감소. 발동은 STUNNED 해제 후 |
| DataManager가 빈 딕셔너리 반환 | `push_error()` + 안전 기본값 (atk=1.0, range=50.0, cd=99.0) |
| 적이 경로 끝 도달 | `reached_goal` 시그널 발행, Wave Defense가 목숨 차감 처리 |
| 두 영웅이 같은 슬롯 배치 시도 | Placement 시스템 책임. slot_id가 이미 설정된 HeroUnit은 재초기화 거부 |
| 보스 페이즈 전환 중 DEAD 진입 | HP 차감 → DEAD 전환 → 페이즈 체크 순서 고정. HP≤0이면 페이즈 건너뜀 |
| 적 HP 오버킬 | `current_hp = max(0.0, current_hp - damage)`. 음수 HP 불허 |
| USING_SKILL 중 타겟 사망 | 스킬 모션 계속 완료. 효과 적용 시점에 타겟 생존 재확인, DEAD면 건너뜀 |
| float 연산 정밀도 | final_atk는 float 유지. 정수 변환은 Combat 시스템 책임 |

---

## Dependencies

| System | Direction | Nature |
|--------|-----------|--------|
| 데이터 설정 | 이 시스템이 의존 | `initialize()` 시 base_stats/enhancement 배율 로드 |
| 전투/데미지 | 이 시스템에 의존 | final_atk, armor, is_in_range(), current_hp 차감 |
| 적 경로/AI | 이 시스템에 의존 | path_points, move_speed, STUNNED 읽기 |
| 타워 배치 | 이 시스템에 의존 | HeroUnit 생성/회수, slot 주입 |
| 스킬 발동 | 이 시스템에 의존 | 쿨다운, USING_SKILL 상태 전환 |
| VFX/파티클 | 이 시스템에 의존 | get_vfx_anchor(), state_changed, unit_died, enhancement_level |
| 웨이브 방어 | 이 시스템에 의존 | unit_died, reached_goal, path 주입 |
| 영웅 수집 | 이 시스템에 의존 | enhancement_level 설정 |

---

## Tuning Knobs

| Parameter | Current | Safe Range | Effect |
|-----------|---------|------------|--------|
| `MIN_SKILL_COOLDOWN` | 1.0s | 0.5 ~ 3.0s | 낮추면 스킬 난사, 높이면 스킬 무의미 |
| `MIN_EFFECTIVE_DAMAGE` | 1 | 0 ~ 5 | 0이면 완전 무효화 가능, 5면 아머 무의미 |
| `VFX_ANCHOR_OFFSET_Y` | -8px | -16 ~ 0px | 파티클 부착 높이 |
| `SAFE_DEFAULT_ATK` | 1.0 | — | DataManager 오류 시 폴백 |
| `SAFE_DEFAULT_RANGE` | 50.0px | — | DataManager 오류 시 폴백 |

---

## Acceptance Criteria

### 영웅 유닛
- [ ] `initialize()` 시 DataManager에서 base_stats가 정확히 로드된다
- [ ] +0 강화 시 `final_atk = base_atk × 1.00`
- [ ] +7 강화 시 `final_atk = base_atk × 1.55`
- [ ] `final_skill_cooldown`이 어떤 배율에서도 1.0초 미만으로 내려가지 않는다
- [ ] DataManager 빈 딕셔너리 반환 시 크래시 없이 안전 기본값 사용

### 적 유닛
- [ ] `initialize()` 시 max_hp, armor, move_speed, reward_gold가 정확히 로드된다
- [ ] 초기화 직후 `current_hp = max_hp`
- [ ] HP ≤ 0 시 DEAD 전환 + `unit_died` 시그널 발행
- [ ] `current_hp`가 음수로 내려가지 않는다

### 상태 전환
- [ ] 상태 전환 시 `state_changed` 시그널이 발행된다
- [ ] STUNNED 상태에서 공격/스킬 발동이 차단된다
- [ ] STUNNED 만료 후 이전 상태로 정확히 복귀한다
- [ ] DEAD 상태에서 다른 상태 전환 시도 시 거부된다 (return false)

### 스탯 계산
- [ ] `final_atk`가 `base_atk × atk_multiplier` 공식과 일치 (오차 ±0.01)
- [ ] +0~+10 전 범위에서 enhancement.json 배율표와 일치

### 위치/연동
- [ ] HeroUnit `world_position` = 슬롯 좌표
- [ ] EnemyUnit `world_position`이 매 프레임 global_position과 동기화
- [ ] `get_vfx_anchor()` = `global_position + Vector2(0, -8)`
- [ ] `unit_died` 시그널 후 Wave Defense가 reward_gold 수령
- [ ] 경로 끝 도달 시 `reached_goal` 시그널 발행
