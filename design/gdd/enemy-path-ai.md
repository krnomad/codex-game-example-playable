# 적 경로/AI (Enemy Path / AI)

> **Status**: Designed
> **Author**: systems-designer + user
> **Last Updated**: 2026-03-28
> **Implements Pillar**: 전투 (적 이동, 경로 추적, 위협 압박의 핵심 규칙)

---

## Overview

풍운지기의 적 경로/AI 시스템은 EnemyUnit이 스테이지에 정의된 경로(Path2D)를 따라
목표 지점까지 자율 이동하는 규칙 전체를 정의한다. 웨이브 방어 시스템이 적을 경로 시작점에
스폰하면, 이 시스템이 매 물리 프레임마다 이동을 처리하고 `distance_traveled`를
누적한다. 전투 시스템은 이 값을 읽어 "가장 앞서 가는 적"을 공격 우선순위 타겟으로 선택한다.
STUNNED 상태, 슬로우 효과, 보스 특수 행동(재생, 하수인 소환) 모두 이 시스템에서 처리된다.
적이 경로 끝에 도달하면 `reached_goal` 시그널을 발행하고 스스로 제거된다.
적이 사망하면 `unit_died` 시그널 위치에서 사망 VFX가 트리거된다.

---

## Player Fantasy

> "웨이브 알림음과 함께 화면 왼쪽에서 불길한 실루엣들이 줄지어 나타난다.
> 선두의 화염 도깨비는 이미 경로 반을 넘겼다. 내 궁수가 막아낼 수 있을까?
> 도사의 슬로우 주문이 떨어지자 무리 전체가 우왕좌왕하며 발이 묶인다 —
> 그 사이 무사의 일격이 선두를 쓰러뜨린다. 안도의 숨을 내쉬는 찰나,
> 두 번째 줄기에서 갑주를 두른 트롤 무리가 묵직하게 걸어온다.
> 경로를 읽고, 선두를 잡고, 다음 위협을 예측하는 것 — 이것이 풍운지기의 심장박동이다."

플레이어가 원하는 감각:
- **위협의 시각적 명확함**: 어느 적이 가장 위험한지 한눈에 보인다 (선두 = 경로 끝에 가장 가까운 적)
- **슬로우/기절의 통쾌함**: 적의 행진을 방해할 때 이동이 즉각적으로, 눈에 띄게 느려진다
- **경로의 긴장감**: 꺾이고 좁아지는 경로가 "저 적이 저기까지 오기 전에 잡아야 해"라는 긴장을 만든다
- **보스의 위압감**: 보스가 입장할 때 일반 적과 다른 크기·속도·재생 능력으로 별도 위협임을 인식한다

---

## Detailed Design

### 경로 정의 방식

#### Godot Path2D + PathFollow2D (MVP 방식)

MVP에서는 Godot 내장 `Path2D` / `PathFollow2D`를 사용한다.

```
스테이지 씬 구조:
StageScene (Node2D)
└── Paths (Node2D)
    ├── Path_A (Path2D)          # 1번 경로
    │   └── SpawnPoint_A (Marker2D)   # 스폰 위치
    └── Path_B (Path2D)          # 2번 경로 (다중 경로 스테이지)
        └── SpawnPoint_B (Marker2D)
```

**Path2D 편집 규칙**:
- Godot 에디터에서 Curve2D 포인트를 찍어 경로를 정의한다
- 경로는 곡선(베지어) 또는 직선 세그먼트 모두 허용
- 스테이지 씬에 저장되며, `stages.json`은 경로 메타데이터(경로 수, 분기 여부)만 참조

**MVP 제약**:
- 분기(branching) 경로 없음 — 각 경로는 단일 선형 경로
- 경로 교차(crossing) 없음
- 다중 경로는 허용 (스테이지당 최대 2개)

**Post-MVP**:
- 웨이브 중 경로 변경 (바리케이드/장벽 스킬)
- 순환 경로 (빙빙 돌며 점점 좁아지는 맵)

#### 경로 길이 사전 계산

Path2D의 `curve.get_baked_length()`를 씬 로드 시 1회 계산해 캐시한다.
이 값은 `distance_traveled` 정규화 및 `EnemyPathSystem`의 경로 완주 판정에 사용된다.

```gdscript
# EnemyPathSystem.gd (씬 로드 시)
var path_lengths: Dictionary = {}   # { "Path_A": 1240.0, "Path_B": 980.0 }

func _cache_path_lengths() -> void:
    for path in get_tree().get_nodes_in_group("enemy_paths"):
        path_lengths[path.name] = path.curve.get_baked_length()
```

---

### 경로 추적 방식 (PathFollow 방식)

각 EnemyUnit은 해당 Path2D에 **PathFollow2D 자식 노드**를 런타임에 추가하는 방식으로
이동한다. EnemyUnit 자신은 PathFollow2D의 `global_position`을 매 프레임 동기화한다.

```
(런타임 생성 구조)
Path_A (Path2D)
└── PathFollow_fire_oni_001 (PathFollow2D)   ← 런타임 생성
    └── (EnemyUnit은 별도 씬, global_position 동기화)
```

> **설계 결정 근거**: EnemyUnit을 PathFollow2D의 자식으로 넣으면 씬 계층 관리가
> 복잡해지고 시그널 연결이 어렵다. 대신 EnemyUnit은 독립 씬으로 유지하고,
> PathFollow2D의 `progress` 값만 읽어 `global_position`을 업데이트한다.
> 이 방식이 Wave Defense의 스폰 인터페이스와 Combat의 시그널 구독을 단순하게 유지한다.

**PathFollow2D 설정**:
- `loop = false` (경로 끝 도달 시 멈춤)
- `rotates = false` (스프라이트는 이동 방향에 관계없이 별도 flip 처리)

---

### 이동 처리 (_physics_process)

EnemyUnit의 `_physics_process(delta)` 내에서 매 물리 프레임 실행된다.

```gdscript
func _physics_process(delta: float) -> void:
    if state == UnitState.STUNNED or state == UnitState.DEAD:
        return

    var effective_speed = _calculate_effective_speed()
    if effective_speed <= 0.0:
        return

    # PathFollow2D progress 전진
    path_follower.progress += effective_speed * delta

    # world_position 동기화
    global_position = path_follower.global_position
    world_position = global_position

    # distance_traveled 누적
    distance_traveled = path_follower.progress

    # 방향에 따른 스프라이트 flip
    _update_sprite_direction()

    # 경로 끝 도달 판정
    if path_follower.progress >= path_length:
        _on_reached_goal()
```

**이동 방향 처리**:
경로에서의 진행 방향 벡터를 기반으로 스프라이트를 좌우 반전한다.

```gdscript
func _update_sprite_direction() -> void:
    var forward = path_follower.get_progress_ratio()  # 0.0 ~ 1.0
    # PathFollow2D의 transform.x 벡터로 방향 판단
    var dir_x = path_follower.transform.basis_xform(Vector2.RIGHT).x
    if dir_x < 0:
        animated_sprite.flip_h = true
    else:
        animated_sprite.flip_h = false
```

---

### distance_traveled 추적

`distance_traveled`는 PathFollow2D의 `progress` 값(픽셀 단위 경로 이동 거리)과
동일하게 유지된다. 별도 계산 없이 동기화한다.

```gdscript
distance_traveled = path_follower.progress   # 단위: px (경로 시작점으로부터)
```

**Combat 시스템 사용 계약**:
- Combat은 사거리 내 적 목록을 `distance_traveled` 내림차순으로 정렬
- 가장 큰 `distance_traveled` 값을 가진 적이 1순위 타겟
- Combat은 이 값을 **읽기 전용**으로만 접근한다

---

### 적 스폰 인터페이스

Wave Defense가 호출하는 공개 API.

```gdscript
# EnemyPathSystem.gd
func spawn_enemy(
    enemy_id: String,         # enemies.json의 id ("fire_oni", "stone_troll")
    path_name: String,        # Path2D 노드 이름 ("Path_A", "Path_B")
    wave_number: int          # 현재 웨이브 번호 (스케일링용)
) -> EnemyUnit:
```

**스폰 절차**:

1. `DataManager.get_enemy(enemy_id)`로 데이터 로드
2. EnemyUnit 씬 인스턴스화 (`EnemyUnit.tscn`)
3. 해당 `Path2D`에 `PathFollow2D` 생성 후 `progress = 0`으로 초기화
4. EnemyUnit의 `path_follower` 참조 주입
5. `path_length` 주입 (캐시된 `path_lengths[path_name]`)
6. `EnemyUnit.initialize(data)` 호출
7. EnemyUnit을 스테이지 씬의 `EnemiesContainer` 노드에 추가
8. EnemyUnit의 `unit_died` 시그널에 Wave Defense 콜백 연결
9. EnemyUnit의 `reached_goal` 시그널에 Wave Defense 콜백 연결
10. 인스턴스 반환

```gdscript
signal enemy_spawned(enemy: EnemyUnit, path_name: String)
signal enemy_reached_goal(enemy: EnemyUnit)
```

**Wave Defense 측 호출 예시**:
```gdscript
var enemy = EnemyPathSystem.spawn_enemy("fire_oni", "Path_A", current_wave)
```

---

### 다중 경로 지원

스테이지당 최대 2개의 독립 경로를 지원한다 (MVP).

- 각 경로는 완전히 독립적으로 동작한다
- 한 경로가 막혔을 때 다른 경로로 우회하는 로직 없음 (Post-MVP)
- Wave Defense가 웨이브 구성(`waves.json`)에 따라 각 경로에 독립적으로 스폰

```json
// waves.json 경로 배정 예시
{
  "wave": 5,
  "spawns": [
    { "enemy_id": "fire_oni",   "path": "Path_A", "count": 3, "interval": 1.0 },
    { "enemy_id": "stone_troll","path": "Path_B", "count": 2, "interval": 1.5 }
  ]
}
```

---

### 속도 수정자 (Speed Modifiers)

#### 슬로우 효과

EnemyUnit은 `slow_stacks` 배열로 활성 슬로우를 관리한다.

```gdscript
# EnemyUnit 추가 필드
var slow_stacks: Array[Dictionary] = []
# 형식: [{ "ratio": 0.4, "duration_remaining": 2.0 }, ...]
```

슬로우는 **비선형 감소(diminishing returns)**를 적용한다. 스택이 쌓일수록 추가 슬로우
효과가 약해져 완전 정지를 방지한다.

```gdscript
func _calculate_effective_speed() -> float:
    var total_slow = _calculate_combined_slow()
    return move_speed * (1.0 - total_slow)

func _calculate_combined_slow() -> float:
    # 각 슬로우를 독립 확률처럼 곱셈 합성 (diminishing returns)
    var remaining_speed_ratio = 1.0
    for stack in slow_stacks:
        remaining_speed_ratio *= (1.0 - stack["ratio"])
    var combined_slow = 1.0 - remaining_speed_ratio
    return min(combined_slow, SLOW_CAP)   # 최대 슬로우 상한 적용
```

**슬로우 적용 API** (스킬 시스템이 호출):
```gdscript
func apply_slow(ratio: float, duration: float) -> void:
    slow_stacks.append({ "ratio": ratio, "duration_remaining": duration })

func _process_slow_timers(delta: float) -> void:
    for i in range(slow_stacks.size() - 1, -1, -1):
        slow_stacks[i]["duration_remaining"] -= delta
        if slow_stacks[i]["duration_remaining"] <= 0.0:
            slow_stacks.remove_at(i)
```

#### STUNNED 상태

STUNNED 중에는 `_physics_process`에서 이동 코드 전체를 건너뛴다.
슬로우 타이머는 STUNNED 중에도 계속 감소한다 (Unit Base 계약 준수).

```gdscript
if state == UnitState.STUNNED or state == UnitState.DEAD:
    _process_slow_timers(delta)   # 슬로우는 계속 소진
    return
```

---

### 보스 특수 행동

보스는 `enemy_type = "BOSS"`이며 `abilities` 배열에 특수 능력 ID를 가진다.
MVP에서는 이동 자체는 일반 적과 동일하며, 특수 능력은 이동 외 별도 타이머로 처리된다.

#### BOSS_REGEN (보스 재생)

보스가 주기적으로 HP를 회복한다. 이동과 독립적으로 동작한다.

```gdscript
# EnemyUnit 보스 전용 필드
var regen_timer: float = 0.0

func _process_boss_abilities(delta: float) -> void:
    if "BOSS_REGEN" in abilities:
        regen_timer -= delta
        if regen_timer <= 0.0:
            var params = ability_params.get("BOSS_REGEN", {})
            var regen_amount = params.get("amount", 50.0)
            var regen_interval = params.get("interval", 3.0)
            current_hp = min(max_hp, current_hp + regen_amount)
            regen_timer = regen_interval
            emit_signal("boss_regen_triggered", self, regen_amount)
```

`ability_params` JSON 예시:
```json
{
  "BOSS_REGEN": { "amount": 50, "interval": 3.0 }
}
```

BOSS_REGEN은 STUNNED 상태에서도 작동한다 (보스 고유 생존력).
DEAD 상태에서는 작동하지 않는다.

#### SUMMON_MINIONS (하수인 소환)

보스가 HP 임계점에 도달할 때 경로에 하수인을 스폰한다.
EnemyPathSystem에 소환 요청 시그널을 발행하면 EnemyPathSystem이 처리한다.

```gdscript
# 보스 페이즈 전환 시 호출 (boss_phase_thresholds 도달)
func _trigger_summon_minions() -> void:
    var params = ability_params.get("SUMMON_MINIONS", {})
    emit_signal("summon_requested", self, params)
    # EnemyPathSystem이 이 시그널을 구독하여 하수인을 스폰
```

`ability_params` JSON 예시:
```json
{
  "SUMMON_MINIONS": {
    "minion_id": "fire_oni_small",
    "count": 3,
    "spawn_behind_offset": 60.0
  }
}
```

하수인은 보스의 현재 `path_follower.progress - spawn_behind_offset` 위치에서 스폰된다.
오프셋이 음수가 되면 경로 시작점(progress = 0)에 클램프한다.

**MVP 제약**: 보스 페이즈 전환은 HP% 기반 1회 소환만 지원.
Post-MVP에서 주기적 소환, 다중 페이즈 소환 추가.

#### 보스 페이즈 전환

`boss_phase_thresholds = [0.5]`이면 HP가 50% 이하로 처음 떨어질 때 1회 트리거.

```gdscript
func _check_phase_transition() -> void:
    var hp_ratio = current_hp / max_hp
    while boss_phase < boss_phase_thresholds.size():
        if hp_ratio <= boss_phase_thresholds[boss_phase]:
            boss_phase += 1
            _trigger_summon_minions()
        else:
            break
```

`apply_damage()` 호출 직후 실행. HP ≤ 0이면 페이즈 체크 건너뜀 (Unit Base 계약 준수).

---

### 경로 끝 도달 처리

```gdscript
func _on_reached_goal() -> void:
    emit_signal("reached_goal", self)
    # Wave Defense가 이 시그널을 구독하여 목숨 차감
    queue_free()
```

EnemyUnit이 `queue_free()`를 직접 호출한다. Wave Defense는 시그널 콜백에서 목숨을 차감한다.
`unit_died`는 발행하지 않는다 — 목숨 차감과 골드 지급은 별개 이벤트다.

---

### 사망 처리

Combat 시스템이 `current_hp -= damage` 후 `transition_to(DEAD)`를 호출하면:

```gdscript
func _on_dead_entered() -> void:
    emit_signal("unit_died", self)
    # VFX 시스템이 unit_died 구독 → 사망 파티클을 global_position에서 트리거
    # Wave Defense가 unit_died 구독 → reward_gold 지급 + 웨이브 완료 카운트
    queue_free()
```

사망 위치는 `unit_died` 시그널 발행 시점의 `global_position`이다.
PathFollow2D는 EnemyUnit `queue_free()` 이후 별도로 제거된다.

```gdscript
func _on_enemy_died(enemy: EnemyUnit) -> void:
    # EnemyPathSystem에서 관리
    if enemy.path_follower and is_instance_valid(enemy.path_follower):
        enemy.path_follower.queue_free()
```

---

## Formulas

### 이동 공식

**프레임당 이동 거리** (PathFollow2D progress 증가량):

```
progress_delta = effective_speed × delta
```

| 변수 | 정의 | 단위 | 범위 |
|------|------|------|------|
| `progress_delta` | 이번 프레임 경로 전진량 | px | 0 ~ 6.0 (60fps 기준) |
| `effective_speed` | 슬로우 적용 후 실제 이동 속도 | px/s | 0 ~ 200 |
| `delta` | 물리 프레임 시간 | s | ~0.0167 (60fps) |

**예시**: `move_speed = 100`, 슬로우 없음, 60fps
- `progress_delta = 100 × 0.0167 = 1.67 px/frame`

---

### 슬로우 합성 공식

**기본 슬로우 (단일 스택)**:
```
effective_speed = move_speed × (1.0 - slow_ratio)
```

**다중 스택 슬로우 (곱셈 합성)**:
```
combined_slow = 1.0 - ∏(1.0 - slow_ratio_i)    for each stack i
effective_speed = move_speed × (1.0 - min(combined_slow, SLOW_CAP))
```

| 변수 | 정의 | 범위 |
|------|------|------|
| `slow_ratio_i` | i번째 슬로우 스택의 감속 비율 | 0.0 ~ 0.8 |
| `combined_slow` | 합성 슬로우 비율 | 0.0 ~ SLOW_CAP |
| `SLOW_CAP` | 최대 슬로우 비율 | 0.75 (기본값) |
| `effective_speed` | 최종 이동 속도 | move_speed × 0.25 이상 |

**예시 — 슬로우 2중 스택**:
- 스택 1: ratio = 0.40 (도사 슬로우)
- 스택 2: ratio = 0.30 (얼음 화살)
- `combined_slow = 1.0 - (1.0 - 0.40) × (1.0 - 0.30) = 1.0 - 0.60 × 0.70 = 0.58`
- `effective_speed = move_speed × (1.0 - 0.58) = move_speed × 0.42`

단순 합산(0.40 + 0.30 = 0.70)보다 낮은 0.58로 감소 — 스택 남용 억제 효과.

**슬로우 상한 (SLOW_CAP = 0.75) 적용 예시**:
- 슬로우 3개 스택: ratio = 0.5, 0.5, 0.5
- `combined_slow = 1.0 - 0.5³ = 0.875 → min(0.875, 0.75) = 0.75`
- 최소 속도 보장: `move_speed × 0.25`

---

### distance_traveled

```
distance_traveled = path_follower.progress    (단위: px)
```

경로 완주 조건:
```
reached_goal = (distance_traveled >= path_length)
```

| 변수 | 정의 | 예시 값 |
|------|------|---------|
| `distance_traveled` | 경로 시작점으로부터의 누적 이동 거리 | 0 ~ 1240 px |
| `path_length` | Path2D의 전체 경로 길이 (캐시) | 800 ~ 1400 px |

---

### 보스 재생 (BOSS_REGEN)

```
current_hp = min(max_hp, current_hp + regen_amount)
```

| 변수 | 정의 | 기본값 |
|------|------|--------|
| `regen_amount` | 회당 회복량 | 50 HP |
| `regen_interval` | 회복 주기 | 3.0 초 |

**예시**: 보스 `max_hp = 2000`, 현재 HP = 1800, `regen_amount = 50`
- `current_hp = min(2000, 1800 + 50) = 1850`
- 4회 연속 무공격 시: `1800 → 1850 → 1900 → 1950 → 2000` (만피 도달 후 더 이상 증가 없음)

---

## Edge Cases

| 상황 | 처리 규칙 |
|------|----------|
| **적이 경로 끝에 정확히 도달** | `path_follower.progress >= path_length` 판정. 초과 이동(오버슈팅)은 PathFollow2D가 자동 클램프. `_on_reached_goal()` 호출 후 `queue_free()`. `unit_died` 시그널 발행 안 함. |
| **STUNNED 상태에서 경로 끝에 있음** | STUNNED 해제 시 다음 프레임에 이동 재개. `progress >= path_length` 이면 즉시 `_on_reached_goal()`. 기절 중에 경로 끝 판정은 하지 않는다 (이동이 없으므로 도달 불가). |
| **effective_speed ≤ 0** | 이동 코드 전체 건너뜀. `distance_traveled` 변화 없음. 경로 끝 판정도 건너뜀. 슬로우 타이머는 계속 소진. |
| **슬로우 스택이 5개 이상 쌓임** | `SLOW_CAP = 0.75` 적용으로 최소 25% 속도 보장. 스택 수 제한 없음 — 합성 공식이 자연스럽게 수렴. |
| **보스가 STUNNED 중 재생 타이머 도달** | BOSS_REGEN은 `_process_boss_abilities(delta)`에서 처리. `_physics_process`에서 이동 코드와 독립적으로 실행되므로 STUNNED 중에도 작동. |
| **SUMMON_MINIONS 트리거 시 경로 시작점 근처** | `spawn_position = max(0.0, boss_progress - spawn_behind_offset)`. 0.0 미만이면 0.0으로 클램프. 경로 시작점 이전에 스폰되지 않음. |
| **보스 HP가 한 번에 여러 임계점 초과** | `_check_phase_transition()` 내 while 루프가 모든 임계점을 순서대로 처리. 이미 HP ≤ 0이면 루프 진입 안 함. |
| **하수인 소환 중 보스 사망** | 소환 시그널이 발행된 직후 DEAD 전환이 발생해도 EnemyPathSystem이 시그널을 처리하여 하수인 스폰 완료. 보스 자체는 `queue_free()`. |
| **Path2D가 씬에 없음 (path_name 오류)** | `spawn_enemy()` 시작 시 경로 유효성 검사. 없으면 `push_error()` + `null` 반환. Wave Defense가 null 체크 후 스폰 건너뜀. |
| **PathFollow2D 참조 유실 (path_follower = null)** | `_physics_process` 시작 시 `if not is_instance_valid(path_follower): push_error(); return`. 이동 중단, 경로 끝 도달 불가 상태로 잔류. |
| **경로에 적 0마리일 때 타겟 선택** | Combat 시스템은 빈 배열 반환 시 IDLE 전환. 이 시스템과 무관. |
| **다중 경로에서 동시 스폰** | 각 경로의 PathFollow2D가 독립적으로 동작. 충돌 없음. |
| **슬로우 duration이 음수로 초기화 시도** | `apply_slow()` 진입 시 `duration <= 0.0`이면 스택 추가 안 함. |

---

## Dependencies

### 이 시스템이 의존하는 시스템

| 시스템 | 의존 내용 |
|--------|----------|
| **Unit Base (EnemyUnit)** | `move_speed`, `state`, `distance_traveled`, `abilities`, `ability_params`, `boss_phase_thresholds`, `transition_to()` 인터페이스 사용 |
| **Data Config (DataManager)** | `spawn_enemy()` 시 `DataManager.get_enemy(enemy_id)` 호출하여 스탯 로드 |
| **Godot Path2D / PathFollow2D** | 경로 정의 및 이동 진행률 관리에 내장 노드 사용 |

### 이 시스템에 의존하는 시스템

| 시스템 | 의존 내용 |
|--------|----------|
| **전투/데미지 (Combat)** | `enemy.distance_traveled` 읽기 (타겟 선택 우선순위). 읽기 전용. |
| **웨이브 방어 (Wave Defense)** | `spawn_enemy()` API 호출. `unit_died` / `reached_goal` 시그널 구독. |
| **VFX/파티클** | `unit_died` 시그널의 `global_position`에서 사망 이펙트 트리거. `boss_regen_triggered` 시그널로 재생 VFX. |
| **Battle HUD** | `enemy.global_position`을 매 프레임 읽어 HP 바 위치 갱신. `current_hp` / `max_hp` 읽기. |
| **스킬 발동 (Skill System)** | `apply_slow(ratio, duration)` API 호출. `transition_to(STUNNED)` 호출. |

---

## Tuning Knobs

| Parameter | 위치 | 기본값 | 안전 범위 | 효과 |
|-----------|------|--------|----------|------|
| `SLOW_CAP` | `EnemyPathSystem` 상수 | 0.75 | 0.5 ~ 0.90 | 높이면 슬로우 조합이 강해짐. 0.90 이상은 사실상 기절과 동일해져 전략 다양성 감소 |
| `move_speed` (enemies.json) | 적별 | 60 ~ 120 | 40 ~ 180 | 낮으면 영웅이 넉넉히 잡음 → 쉬움. 높으면 압박감 증가. 180 초과 시 32px 픽셀 아트에서 시각적으로 튀는 이동 발생 |
| `regen_amount` (ability_params) | 보스별 | 50 | 20 ~ 150 | 낮으면 재생이 무의미. DPS가 100+ 이상인 팀에서는 50도 체감 약함. 영웅 팀 DPS 대비 30% 이하 권장 |
| `regen_interval` (ability_params) | 보스별 | 3.0s | 1.5 ~ 5.0s | 1.5s 미만은 실시간 회복으로 체감. 5.0s 초과는 사실상 무효 |
| `spawn_behind_offset` (ability_params) | 보스별 | 60 px | 30 ~ 120 px | 너무 작으면 하수인이 보스와 겹쳐 스폰. 너무 크면 이미 지나온 구간에 스폰되어 위협 감소 |
| `path_length` | 스테이지 설계 | 800 ~ 1400 px | 600 ~ 1800 px | 짧으면 긴장감 높음/여유 없음. 길면 전략적 배치 공간 확보. 960x540 화면 기준 2~3 화면 분량 권장 |
| 슬로우 스택 개수 상한 | (없음 — 합성 공식이 수렴) | N/A | N/A | SLOW_CAP이 상한을 실질적으로 제어하므로 별도 스택 제한 불필요 |

---

## Acceptance Criteria

### 경로 추적

- [ ] 스폰 직후 `distance_traveled = 0.0`
- [ ] 60fps에서 `distance_traveled`가 매 프레임 `move_speed × delta`씩 증가한다 (오차 ±0.5px)
- [ ] `distance_traveled`는 `path_length`를 초과하지 않는다
- [ ] 경로 끝 도달 시 `reached_goal` 시그널이 정확히 1회 발행된다
- [ ] 경로 끝 도달 후 `unit_died` 시그널이 발행되지 않는다

### 스폰 인터페이스

- [ ] `spawn_enemy("fire_oni", "Path_A", 1)` 호출 시 EnemyUnit이 Path_A 시작점에 생성된다
- [ ] 잘못된 `path_name` 전달 시 `null` 반환 + 에러 로그, 크래시 없음
- [ ] 스폰된 EnemyUnit의 `max_hp`, `move_speed`, `armor`가 enemies.json 값과 일치한다
- [ ] 동시에 20마리 스폰 시 60fps 유지 (16.6ms 프레임 버짓 이내)

### 이동 상태

- [ ] STUNNED 상태에서 `distance_traveled`가 변하지 않는다
- [ ] STUNNED 해제 후 다음 프레임에 이동이 즉시 재개된다
- [ ] DEAD 상태에서 이동 코드가 실행되지 않는다

### 슬로우

- [ ] 슬로우 ratio 0.4 적용 시 `effective_speed = move_speed × 0.6`
- [ ] 슬로우 2개 스택(0.4, 0.3) 합성 시 `effective_speed = move_speed × 0.42` (오차 ±0.01)
- [ ] 슬로우 3개 스택으로 `combined_slow > 0.75` 발생 시 `effective_speed = move_speed × 0.25`로 하한 유지
- [ ] 슬로우 duration 만료 후 스택이 배열에서 제거되고 `effective_speed`가 복구된다
- [ ] `apply_slow(0.5, 0.0)` (duration = 0) 호출 시 스택이 추가되지 않는다

### 보스 특수 능력

- [ ] BOSS_REGEN: 매 3초마다 `current_hp`가 `regen_amount`만큼 증가한다
- [ ] BOSS_REGEN: `current_hp`가 `max_hp`를 초과하지 않는다
- [ ] BOSS_REGEN: STUNNED 상태에서도 작동한다
- [ ] BOSS_REGEN: DEAD 상태에서 작동하지 않는다
- [ ] SUMMON_MINIONS: HP 50% 임계점 도달 시 `summon_requested` 시그널이 1회 발행된다
- [ ] SUMMON_MINIONS: `spawn_behind_offset`이 보스 `progress`보다 크면 하수인이 progress = 0에 스폰된다
- [ ] 보스 HP가 한 번에 50% → 0%로 감소해도 페이즈 트리거 후 DEAD 진행된다

### 다중 경로

- [ ] Path_A와 Path_B에 동시에 적을 스폰하면 각각 독립적으로 이동한다
- [ ] Path_A의 적이 사망해도 Path_B의 적 이동에 영향 없음

### 사망 정리

- [ ] `unit_died` 시그널 발행 후 EnemyUnit 노드가 씬 트리에서 제거된다
- [ ] EnemyUnit 제거 후 해당 PathFollow2D도 제거된다
- [ ] `unit_died` 발행 시점의 `global_position`이 마지막 이동 위치와 일치한다
