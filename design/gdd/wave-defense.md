# 웨이브 방어 (Wave Defense)

> **Status**: Designed
> **Author**: systems-designer + user
> **Last Updated**: 2026-03-28
> **Implements Pillar**: 전투 긴장감 (웨이브 생존의 긴박함, 게임 디렉터 역할)

---

## 1. Overview

웨이브 방어 시스템(WaveDefenseSystem)은 풍운지기의 **게임 디렉터(Game Director)**다.
플레이어가 스테이지에 진입하는 순간부터 승리 또는 패배 판정이 내려질 때까지,
모든 하위 시스템(적 경로/AI, 영웅 배치, 전투/데미지, 경제)의 흐름을 지휘한다.

이 시스템이 책임지는 것:

- 스테이지/웨이브 상태 기계(State Machine) 운영
- `waves.json`을 읽어 적 그룹을 스케줄대로 스폰
- 후반 난이도 램프(HP/속도 스케일, 엘리트 변형) 적용
- 생명력(목숨, Lives) 차감 및 패배 판정
- 웨이브 완료 및 스테이지 완료 감지
- 별점(1~3성) 산정
- 웨이브/스테이지 보상 트리거 (EconomyManager 호출)
- 준비→전투→결과 화면 전환 신호 발행
- 일시정지 및 2배속 제어

WaveDefenseSystem은 씬 루트에 `Autoload`가 아닌 **씬 로컬 싱글턴**으로 존재한다.
스테이지 씬이 언로드되면 함께 소멸하여 상태 누출을 방지한다.

---

## 2. Player Fantasy

> "북소리가 울린다. 화면 가장자리에 '웨이브 1 / 8' 이라는 글자가 번쩍이고,
> 안개 속에서 도깨비 무리가 쏟아져 나온다.
> 내 궁수가 첫 번째 화살을 날리고, 골드 숫자가 화면 위로 튀어오른다.
> 6웨이브까지는 여유로웠다. 7웨이브 — 갑자기 경로 두 줄이 동시에 열린다.
> 오른쪽 줄에서 갑주 트롤이 밀려들고, 남은 목숨이 20에서 17로, 14로 줄어든다.
> 손에 땀이 난다. 마지막 보스 웨이브가 시작되자 화면 전체가 붉게 물든다.
> 보스를 처치하는 순간 — 황금빛 '스테이지 클리어!' 텍스트,
> 쏟아지는 보상, 그리고 별 세 개."

플레이어가 원하는 감각:

- **긴장의 고조**: 웨이브가 진행될수록 적의 수와 속도가 늘어나는 압박감
- **방어선의 가치**: 내 영웅 배치와 강화 투자가 실제로 웨이브를 막아내는 성취감
- **목숨의 긴장감**: 생명력 20 → 0의 숫자 하나하나가 위기감을 만든다
- **보스의 사건성**: 보스 웨이브는 일반 웨이브와 다른 음악·연출로 특별한 순간임을 알린다
- **별점의 동기**: 3성 클리어는 단순 완료보다 더 큰 보상 — 재도전 이유가 생긴다

---

## 3. Detailed Design

### 3.1 상태 기계 (State Machine)

WaveDefenseSystem은 두 계층의 상태 기계를 운영한다.

#### 스테이지 상태 (Stage State)

```
LOADING
  │  (씬 로드 완료, waves.json 파싱)
  ▼
PLACEMENT          ← 플레이어가 영웅을 배치하는 단계
  │  (placement_ready 시그널 수신 OR 수동 시작 버튼)
  ▼
WAVES              ← 웨이브 루프 (내부 상태 기계 구동)
  │  (모든 웨이브 완료)            (lives == 0)
  ▼                               ▼
VICTORY                         DEFEAT
  │
  ▼
[스테이지 씬 언로드]
```

#### 웨이브 상태 (Wave State) — WAVES 상태 내부

```
PREP
  │  (준비 타이머 만료 OR 플레이어 수동 시작)
  ▼
SPAWNING           ← 현재 웨이브의 적 그룹을 스케줄대로 스폰
  │  (모든 그룹 스폰 완료)
  ▼
ACTIVE             ← 살아있는 적이 존재. 전투 진행 중
  │  (active_enemies.size() == 0)
  ▼
CLEARED            ← 웨이브 클리어. 보상 지급
  │  (마지막 웨이브이면 → 스테이지 VICTORY)
  │  (마지막 웨이브 아니면 → 다음 웨이브 PREP)
  ▼
PREP (다음 웨이브)
```

**상태 전이 규칙**:

| 현재 상태 | 전이 조건 | 다음 상태 | 부수 효과 |
|----------|---------|---------|---------|
| LOADING | DataManager 로드 완료 | PLACEMENT | HUD 초기화, 영웅 패널 표시 |
| PLACEMENT | `placement_ready` 수신 | WAVES / PREP | 영웅 패널 최소화, 첫 웨이브 PREP 시작 |
| PREP | prep_timer 만료 | SPAWNING | 웨이브 카운터 UI 갱신 |
| PREP | 수동 시작 버튼 클릭 | SPAWNING | prep_timer 즉시 종료 |
| SPAWNING | 마지막 그룹 스폰 완료 | ACTIVE | — |
| ACTIVE | active_enemies == 0 | CLEARED | 웨이브 클리어 연출 트리거 |
| ACTIVE | lives == 0 | — (스테이지 DEFEAT) | 패배 연출 트리거 |
| CLEARED | wave_index < total_waves | PREP (wave_index+1) | 웨이브 보상 지급 |
| CLEARED | wave_index == total_waves | — (스테이지 VICTORY) | 스테이지 클리어 연출 트리거 |

---

### 3.2 스테이지 수명주기 (Stage Lifecycle)

#### LOADING

스테이지 씬 로드 시 WaveDefenseSystem이 수행하는 초기화:

1. `DataManager.get_waves(stage_id)` 호출 → 웨이브 배열 캐시
2. `DataManager.get_stage(stage_id)` 호출 → 별점 조건, 총 웨이브 수 캐시
3. `lives = MAX_LIVES` (기본값 20) 초기화
4. `wave_index = 0`, `total_waves = waves.size()` 설정
5. `active_enemies = []` 초기화
6. EnemyPathSystem의 `reached_goal` 시그널 연결
7. 각 EnemyUnit의 `unit_died` 시그널 연결 (스폰 시점에 동적 연결)
8. PlacementSystem의 `placement_ready` 시그널 연결

#### PLACEMENT

- PlacementSystem이 주도하는 단계. WaveDefenseSystem은 관찰자 역할
- `placement_ready` 시그널 수신 시 즉시 WAVES 상태로 전이
- 전투 중 재배치는 PlacementSystem 규칙에 따라 허용 (WAVES 상태에서도 제한적 허용)
- 이 단계에서 웨이브 시작 버튼(수동 시작)을 누를 수 없음 — 반드시 `placement_ready` 필요

#### WAVES

웨이브 루프가 돌아가는 핵심 단계. 내부 웨이브 상태 기계(3.1 참고)를 구동한다.

#### VICTORY

1. `stage_cleared` 시그널 발행 (파라미터: `stars`, `time_elapsed`, `lives_remaining`)
2. EconomyManager.earn_gold / earn_stones 호출 (스테이지 클리어 보너스)
3. 별점 저장 (StageProgressionSystem이 수신)
4. 결과 화면(Victory Screen) 씬 로드

#### DEFEAT

1. `stage_failed` 시그널 발행
2. 스테이지 클리어 보너스 지급 없음 (웨이브별 보상은 이미 지급된 상태 유지)
3. 패배 화면(Defeat Screen) 씬 로드

---

### 3.3 웨이브 스폰 (Wave Spawning)

#### waves.json 스키마

```json
{
  "meta": { "version": "1.0.0", "last_updated": "YYYY-MM-DD", "description": "웨이브 구성" },
  "stage_1": {
    "total_waves": 8,
    "waves": [
      {
        "wave_index": 1,
        "is_boss_wave": false,
        "groups": [
          {
            "enemy_id": "fire_oni",
            "count": 5,
            "spawn_delay": 1.0,
            "path_id": "Path_A",
            "group_delay": 0.0
          }
        ]
      },
      {
        "wave_index": 8,
        "is_boss_wave": true,
        "groups": [
          {
            "enemy_id": "great_fire_oni_boss",
            "count": 1,
            "spawn_delay": 0.0,
            "path_id": "Path_A",
            "group_delay": 0.0
          },
          {
            "enemy_id": "fire_oni",
            "count": 4,
            "spawn_delay": 1.5,
            "path_id": "Path_A",
            "group_delay": 3.0
          }
        ]
      }
    ]
  }
}
```

**필드 정의**:

| 필드 | 타입 | 설명 |
|------|------|------|
| `wave_index` | int | 1-based 웨이브 번호 (1 ~ total_waves) |
| `is_boss_wave` | bool | 보스 웨이브 여부. true이면 특수 연출 트리거 |
| `groups` | Array | 이 웨이브에서 스폰되는 적 그룹 목록 |
| `enemy_id` | String | enemies.json의 enemy ID |
| `count` | int | 이 그룹에서 스폰할 적 수 |
| `spawn_delay` | float | 같은 그룹 내 적 1마리씩 스폰 간격 (초) |
| `path_id` | String | 이 그룹이 사용할 경로 노드 이름 ("Path_A" 또는 "Path_B") |
| `group_delay` | float | 이전 그룹 스폰 시작 후, 이 그룹이 시작되기까지의 대기 시간 (초) |

#### 스폰 알고리즘

SPAWNING 상태 진입 시 아래 순서로 실행한다.

```
wave_data = waves[wave_index - 1]
cumulative_delay = 0.0

#### 프로토타입 난이도 램프 메모 (2026-03-28)

- 웨이브 HP 스케일은 기존보다 가파르게 적용한다
- 4웨이브 이후 일반 적 일부가 `엘리트`로 변형될 수 있다
- 엘리트는 추가 HP, 속도, 방어, 보상, 보물 드랍 확률을 가진다
- 보스 웨이브 직전과 직후에는 Battle HUD가 위협 단계(Tier)를 갱신한다

for group in wave_data.groups:
    cumulative_delay += group.group_delay
    for i in range(group.count):
        individual_delay = cumulative_delay + (i * group.spawn_delay)
        schedule_spawn(group.enemy_id, group.path_id, individual_delay)

total_scheduled = sum of all count values
spawned_count = 0
```

`schedule_spawn`은 `get_tree().create_timer(delay).timeout` 콜백으로 구현한다.
타이머 만료 시 `EnemyPathSystem.spawn_enemy(enemy_id, path_node, 0.0)` 호출.

`spawned_count`가 `total_scheduled`에 도달하면 SPAWNING → ACTIVE 전이.

**일시정지 중 타이머 처리**: `SceneTree.paused = true` 상태에서 생성된 타이머는
`process_mode = WHEN_PAUSED` 가 아닌 기본값을 쓰므로 자동으로 멈춘다. (3.7 참고)

#### 보스 웨이브 스폰 (Boss Wave Spawning)

`is_boss_wave == true`인 웨이브 진입 시:

1. 음악 전환 시그널 발행: `boss_wave_started` (AudioSystem이 수신)
2. 화면 테두리 붉은 점멸 연출 시작 (VFX 시그널: `screen_flash("red", 1.0)`)
3. 보스 체력바 UI 활성화 시그널 발행: `boss_spawned(boss_unit)` (Battle HUD가 수신)
4. 보스 그룹은 groups[0]에 정의 (count == 1 강제, enemies.json에서 `is_boss: true` 확인)
5. 스폰 자체는 일반 적과 동일하게 `EnemyPathSystem.spawn_enemy()` 사용

보스 EnemyUnit이 `reached_goal` 시그널을 발행하면 lives 차감은 동일하게 처리한다.
보스 EnemyUnit이 `unit_died` 시그널을 발행하면 `boss_killed` 시그널을 추가 발행한다.

---

### 3.4 생명력 시스템 (Lives System)

#### 목숨 정의

| 항목 | 값 |
|------|-----|
| 최대 목숨 (`MAX_LIVES`) | 20 |
| 시작 목숨 | 20 |
| 목숨 회복 | 없음 (MVP) |
| 패배 조건 | lives == 0 |

#### 목숨 차감 규칙

EnemyPathSystem이 `reached_goal(enemy_unit)` 시그널을 발행하면:

1. `lives -= enemy_unit.lives_damage` (기본값 1; 보스는 enemies.json에서 별도 설정)
2. `lives_changed(lives)` 시그널 발행 (Battle HUD가 수신해 UI 갱신)
3. `lives <= 0` 이면: `lives = 0` 클램프 후 즉시 DEFEAT 전이
4. 해당 EnemyUnit을 `active_enemies`에서 제거

**보스의 목숨 차감**: enemies.json에서 `lives_damage` 필드로 정의. 기본값 1. 보스는 3~5 권장.

#### `lives_damage` 필드 (enemies.json 추가 스키마)

```json
{
  "id": "great_fire_oni_boss",
  "is_boss": true,
  "lives_damage": 5,
  ...
}
```

---

### 3.5 웨이브 완료 감지 (Wave Completion Detection)

ACTIVE 상태에서 매 `_process` 프레임마다 아래 조건을 확인한다.

```
if active_enemies.size() == 0 and spawned_count == total_scheduled:
    → CLEARED 전이
```

`active_enemies` 배열 관리:

- 적 스폰 시: `active_enemies.append(enemy_unit)`
- `unit_died` 수신 시: `active_enemies.erase(enemy_unit)`
- `reached_goal` 수신 시: `active_enemies.erase(enemy_unit)` (lives 차감 후)

**중요**: `spawned_count == total_scheduled` 조건이 없으면 SPAWNING 도중 잠깐 active_enemies가
비어있는 순간에 오탐 클리어가 발생한다. 반드시 두 조건 모두 확인해야 한다.

---

### 3.6 웨이브 간 인터벌 (Between-Wave Interval)

웨이브 CLEARED → 다음 웨이브 PREP 전환 시 인터벌이 발생한다.

| 단계 | 시간 | 설명 |
|------|------|------|
| 클리어 연출 | 1.5초 | 클리어 텍스트 팝업, 보상 획득 UI 표시 |
| 자동 준비 타이머 | 5.0초 | 플레이어가 영웅 재배치, 스킬 확인 가능 시간 |
| 수동 시작 | 타이머 중단 | "다음 웨이브" 버튼으로 즉시 시작 가능 |

**전투 중 영웅 재배치**: PREP 상태에서만 허용. ACTIVE/SPAWNING 중에는 배치 패널 잠금
(PlacementSystem에 `set_placement_locked(true)` 호출).

**PREP 상태의 UI 표시**:
- "다음 웨이브 시작" 버튼 활성화
- 준비 타이머 카운트다운 표시 ("5... 4... 3...")
- 현재 목숨 수, 웨이브 번호 갱신 완료

---

### 3.7 일시정지 / 2배속 (Pause / Speed Controls)

#### 일시정지 (Pause)

- 일시정지 버튼 또는 ESC 키 → `InputControl` 시스템이 `pause_requested` 시그널 발행
- WaveDefenseSystem이 수신: `get_tree().paused = true`
- 일시정지 UI 오버레이 표시 (씬 트리 바깥 CanvasLayer, process_mode = WHEN_PAUSED)
- 재개 시: `get_tree().paused = false`

**일시정지 가능 상태**: PLACEMENT, PREP, SPAWNING, ACTIVE 모두 허용.
CLEARED(클리어 연출 중) 일시정지는 허용하되, 연출 타이머도 함께 멈춘다.

#### 2배속 (2x Speed)

- 2배속 토글 버튼 → `speed_2x_toggled(is_active: bool)` 시그널
- WaveDefenseSystem이 수신: `Engine.time_scale = 2.0` (활성) / `Engine.time_scale = 1.0` (비활성)
- ACTIVE 및 SPAWNING 상태에서만 활성화 가능
- PREP, PLACEMENT 상태에서는 2배속 버튼 비활성화

**`Engine.time_scale` 사용 이유**: Godot의 `time_scale`은 `_process(delta)`, 물리, 타이머,
애니메이션 모두에 적용되어 별도 속도 로직 없이 전체 시뮬레이션이 빨라진다.

---

### 3.8 별점 시스템 (Star Rating)

스테이지 클리어 시 남은 목숨 수를 기준으로 별점을 산정한다.

| 별점 | 한국어 | 조건 | 보상 배율 |
|------|--------|------|---------|
| ★☆☆ (1성) | 클리어 | `lives >= 1` | 1.0× |
| ★★☆ (2성) | 선전 | `lives >= 15` | 1.3× |
| ★★★ (3성) | 완벽 | `lives == 20` (단 한 명도 통과시키지 않음) | 1.6× + 강화석 1 추가 |

**3성 조건의 엄격함 근거**: 20개 목숨을 전부 유지해야 3성 → 재도전 동기 강력.
2성 조건(15개 이상 유지 = 최대 5명 통과 허용)은 첫 클리어 시 자연스럽게 도달 가능한 수준.

별점 결과는 `stage_cleared(stars, lives_remaining, time_elapsed)` 시그널로 전파한다.

---

### 3.9 보상 지급 (Reward Distribution)

#### 킬 보상 (Per-Kill Reward) — 즉시 지급

적이 `unit_died` 시그널 발행 시 즉시 처리:

```gdscript
EconomyManager.earn_gold(enemy_unit.reward_gold, "kill")
```

`reward_gold`는 enemies.json의 각 적에 정의된다. 보스는 별도로 높은 값 설정.

#### 웨이브 완료 보상 (Wave Clear Reward) — CLEARED 진입 시

Economy GDD의 공식 사용 (economy.md §3.2):

```
wave_gold = base_wave_gold × stage_gold_multiplier[stage] × wave_index_bonus[wave]
```

```gdscript
# WaveDefenseSystem.gd (CLEARED 진입 시)
var wave_gold = EconomyManager.calculate_wave_reward(stage_id, wave_index)
EconomyManager.earn_gold(wave_gold, "wave_clear")
```

`calculate_wave_reward`의 구현은 EconomyManager 담당. WaveDefenseSystem은 호출만 한다.

#### 스테이지 클리어 보상 (Stage Clear Reward) — VICTORY 진입 시

Economy GDD의 공식 사용 (economy.md §3.2):

```
stage_bonus_gold   = base_stage_clear_gold × stage_multiplier[stage] × star_gold_bonus[stars]
stage_bonus_stones = base_stage_clear_stones × stage_multiplier[stage] × star_stone_bonus[stars]
```

| 별점 | star_gold_bonus | star_stone_bonus |
|------|-----------------|-----------------|
| 1성 | 1.0× | 1.0× |
| 2성 | 1.3× | 1.3× |
| 3성 | 1.6× | 1.6× (+ 강화석 1 고정 추가) |

```gdscript
# WaveDefenseSystem.gd (VICTORY 진입 시)
var stars = _calculate_stars()
EconomyManager.grant_stage_clear_reward(stage_id, stars)
```

#### 영웅 조각 드롭 (Hero Shard Drop) — CLEARED 또는 VICTORY 시

웨이브 완료 시 확률적으로 영웅 조각 드롭. Economy GDD의 드롭 테이블 참고.

```gdscript
EconomyManager.roll_wave_shard_drop(stage_id, wave_index)
```

구체적 확률과 드롭 테이블은 economy.json에 정의.

#### 보물 지급 (Treasure Reward) — 프로토타입 전투 로컬 보상

현재 프로토타입에서는 장기 영속 자원과 별도로, 한 판 내부에서만 쓰는 `보물`을 지급한다.

- 웨이브 클리어: 1개 기본, 후반 웨이브는 추가 1개 가능
- 엘리트 적 처치: 확률 드랍
- 보스 처치: 2개 고정

이 보상은 `TreasureForgeSystem` 또는 전투 씬 로컬 상태에 전달되며,
다음 PREP/CLEARED 구간에서 보물 공방 UI를 통해 즉시 소비된다.

---

### 3.10 웨이브 카운터 UI 데이터 (Wave Counter UI Data)

WaveDefenseSystem은 UI에 필요한 데이터를 시그널로 전파한다. UI 시스템은 직접 WaveDefenseSystem에 접근하지 않는다.

| 시그널 | 파라미터 | 수신자 | 설명 |
|--------|---------|--------|------|
| `wave_changed(wave_index, total_waves)` | int, int | Battle HUD | "웨이브 N/M" 표시 갱신 |
| `lives_changed(lives)` | int | Battle HUD | 목숨 UI 갱신 |
| `wave_state_changed(state)` | WaveState | Battle HUD | PREP/ACTIVE/CLEARED 등 상태 변화 |
| `stage_cleared(stars, lives, time)` | int, int, float | Battle HUD, Stage Progression | 클리어 결과 |
| `stage_failed` | — | Battle HUD | 패배 처리 |
| `boss_wave_started` | — | Audio, VFX | 보스 웨이브 연출 트리거 |
| `boss_spawned(enemy_unit)` | EnemyUnit | Battle HUD | 보스 체력바 활성화 |
| `boss_killed` | — | Audio, VFX | 보스 처치 연출 트리거 |
| `prep_timer_tick(seconds_remaining)` | float | Battle HUD | 준비 카운트다운 갱신 |

---

## 4. Formulas

### 4.1 스폰 타이밍 공식 (Spawn Timing Formula)

같은 그룹 내 개별 적의 절대 스폰 시각:

```
T_spawn(group_i, enemy_j) = sum(group_delay[0..i]) + j × spawn_delay[i]
```

**변수 정의**:
- `group_delay[i]`: 그룹 i의 `group_delay` 필드 (0번 그룹은 0.0)
- `spawn_delay[i]`: 그룹 i의 `spawn_delay` 필드
- `j`: 그룹 i 내 j번째 적 (0-based)

**예시 계산** (스테이지 1, 웨이브 2):

```
groups = [
  { count: 3, spawn_delay: 1.0, group_delay: 0.0, path: "Path_A" },
  { count: 2, spawn_delay: 2.0, group_delay: 4.0, path: "Path_B" }
]

Path_A 적 1: T = 0.0 + 0 × 1.0 = 0.0초
Path_A 적 2: T = 0.0 + 1 × 1.0 = 1.0초
Path_A 적 3: T = 0.0 + 2 × 1.0 = 2.0초
Path_B 적 1: T = 4.0 + 0 × 2.0 = 4.0초
Path_B 적 2: T = 4.0 + 1 × 2.0 = 6.0초

총 웨이브 스폰 소요 시간: 6.0초
```

---

### 4.2 웨이브 보상 공식 (Wave Reward Formula)

Economy GDD (economy.md §3.2)에서 정의된 공식을 위임 호출한다.
WaveDefenseSystem은 `wave_index`와 `stage_id`를 EconomyManager에 넘기고 결과를 받는다.

**참고용 공식**:
```
wave_gold = base_wave_gold × stage_gold_multiplier[stage] × wave_index_bonus[wave]
```

| 파라미터 | 소스 | 기본값 |
|---------|------|--------|
| `base_wave_gold` | economy.json | 120 |
| `stage_gold_multiplier` | economy.json (스테이지 1=1.0, 스테이지 5=2.0) | 1.0 |
| `wave_index_bonus` | economy.json (초반=1.0, 후반=1.3) | 1.0 |

**예시** (스테이지 1, 웨이브 8/8 마지막 웨이브):
```
wave_gold = 120 × 1.0 × 1.3 = 156골드
```

---

### 4.3 스테이지 클리어 보상 공식 (Stage Clear Reward Formula)

Economy GDD (economy.md §3.2)에서 정의된 공식을 위임 호출한다.

```
stage_bonus_gold   = base_stage_clear_gold × stage_multiplier × star_gold_bonus[stars]
stage_bonus_stones = base_stage_clear_stones × stage_multiplier × star_stone_bonus[stars]
```

| 파라미터 | 소스 | 기본값 |
|---------|------|--------|
| `base_stage_clear_gold` | economy.json | 400 |
| `base_stage_clear_stones` | economy.json | 2 |
| `stage_multiplier` | economy.json (스테이지별 차등) | 1.0 |

**예시** (스테이지 1, 3성 클리어):
```
stage_bonus_gold   = 400 × 1.0 × 1.6 = 640골드
stage_bonus_stones = 2 × 1.0 × 1.6 + 1 = 4.2 → floor → 4강화석 + 1 = 총 4강화석
```

(소수점은 floor 처리 후 고정 추가분 합산)

---

### 4.4 별점 산정 공식 (Star Rating Formula)

```
stars = 3  if lives == MAX_LIVES
stars = 2  if lives >= STAR_2_LIVES_THRESHOLD  (기본값 15)
stars = 1  if lives >= 1
stars = 0  if lives == 0  [발생하지 않음: lives==0은 DEFEAT]
```

**변수 정의**:
- `lives`: 스테이지 종료 시 남은 목숨 수
- `MAX_LIVES`: 20 (tuning knob)
- `STAR_2_LIVES_THRESHOLD`: 15 (tuning knob)

---

### 4.5 난이도 압박 지표 (Difficulty Pressure Indicator)

구현 용도가 아닌 **waves.json 작성 가이드**로 사용하는 참고 지표.

```
wave_pressure = (total_enemy_count × avg_enemy_hp × avg_enemy_speed) / wave_duration
```

| 파라미터 | 설명 |
|---------|------|
| `total_enemy_count` | 이 웨이브의 전체 적 수 |
| `avg_enemy_hp` | 이 웨이브 적들의 평균 HP |
| `avg_enemy_speed` | 이 웨이브 적들의 평균 이동 속도 |
| `wave_duration` | 스폰 시작부터 마지막 적 스폰까지 소요 초 (§4.1 공식으로 계산) |

**설계 가이드라인**: 스테이지 내에서 `wave_pressure`는 단조증가(monotone increase)해야 한다.
마지막 웨이브의 pressure가 첫 웨이브 대비 2.5~4.0배 범위를 목표로 한다.

---

## 5. Edge Cases

### EC-1: 마지막 적이 목표 도달과 동시에 사망

**시나리오**: 마지막 남은 적이 같은 프레임에 `reached_goal`과 `unit_died`를 동시에 발행하는 경우.

**처리 규칙**:
- Godot 시그널은 동기(synchronous) 발행. 같은 프레임에 두 시그널이 발행되면 연결 순서대로 처리됨.
- WaveDefenseSystem은 `reached_goal`을 먼저 처리: lives 차감, active_enemies 제거.
- `unit_died`는 이미 제거된 유닛에 대해 도착. `active_enemies.erase(enemy_unit)`는 없으면 무시(GDScript Array.erase는 없는 원소 지우기를 오류 없이 처리).
- lives 차감이 먼저 발생하므로 목숨은 정확히 1 감소.
- `active_enemies.size() == 0 and spawned_count == total_scheduled` 조건 충족 → 정상적으로 CLEARED 전이.

**결론**: 별도 처리 없음. 자연스럽게 처리됨. 단, 적 제거 후 `unit_died`의 중복 킬 보상 지급을 막기 위해 EnemyUnit 내부에 `_is_reward_given` 플래그를 사용한다. (EnemyUnit 책임)

---

### EC-2: 일시정지 중 스폰 타이머 만료

**시나리오**: `SceneTree.paused = true` 상태에서 스폰 타이머가 있는 경우.

**처리 규칙**:
- `get_tree().create_timer(delay)` 로 생성된 타이머는 `SceneTree.paused = true` 시 자동으로 정지된다 (Godot 기본 동작).
- 재개 시 남은 시간부터 계속 흐름.
- 결과: 일시정지 중에는 적이 스폰되지 않음. 정상 동작.

**검증 필요**: 웹 브라우저 탭 전환 시 Godot의 `time_scale` 또는 `Engine.get_frames_per_second()` 동작이 달라질 수 있음. 웹 빌드에서 탭 전환 후 재진입 시 스폰 타이머 동기화 테스트 필요.

---

### EC-3: 웨이브 ACTIVE 중 영웅 전원 제거

**시나리오**: 플레이어가 전투 중 모든 영웅을 슬롯에서 제거한 경우.

**처리 규칙**:
- 이는 PlacementSystem의 규칙이 허용하는 한 가능한 상황.
- WaveDefenseSystem은 영웅이 0명이어도 ACTIVE 상태를 유지한다. 패배 조건은 오직 `lives == 0`.
- 영웅이 없으면 CombatSystem이 공격을 발생시키지 않음 → 적이 목표에 도달 → lives 차감 → 반복.
- 결과: 영웅 0명 상태가 지속되면 자연스럽게 DEFEAT 도달. 별도 예외 처리 없음.
- **디자인 보호장치**: PlacementSystem이 ACTIVE 중 전체 제거를 허용하지 않도록 최소 1영웅 유지를 강제하는 것은 PlacementSystem의 결정 사항. WaveDefenseSystem은 관여하지 않음.

---

### EC-4: waves.json에 정의되지 않은 enemy_id 참조

**시나리오**: `waves.json`의 `enemy_id`가 `enemies.json`에 없는 경우.

**처리 규칙**:
- DataManager는 로드 시 크로스-레퍼런스 검증을 수행 (data-config.md §3).
- 검증 실패 시 `data_load_failed` 시그널 발행 → 게임 부트 차단.
- 런타임에는 발생하지 않음. DataManager 검증이 사전 차단.

---

### EC-5: 웨이브 도중 브라우저 탭 비활성화 (백그라운드 전환)

**시나리오**: 웹 브라우저에서 다른 탭으로 이동 후 복귀.

**처리 규칙**:
- Godot 웹 빌드는 탭 비활성화 시 `Engine.time_scale`이 브라우저에 의해 제한될 수 있음.
- 복귀 시 큰 delta 값이 `_process(delta)`에 전달되어 적이 순간이동하는 현상 발생 가능.
- **방어**: EnemyPathSystem에서 `delta`를 `clamp(delta, 0, MAX_DELTA)`로 캡핑 (MAX_DELTA = 0.1초 = 6프레임). (EnemyPathSystem 책임)
- WaveDefenseSystem은 이 delta 캡핑에 의존하며 별도 처리 없음.

---

### EC-6: SPAWNING 중 lives가 0이 되는 경우

**시나리오**: SPAWNING 상태에서 이미 스폰된 적들이 목표에 도달해 lives가 0이 되는 경우.

**처리 규칙**:
- ACTIVE 상태가 아니더라도 `reached_goal` 시그널은 처리된다. WaveDefenseSystem은 SPAWNING 중에도 `reached_goal` 핸들러가 활성 상태.
- `lives <= 0` 확인 → 즉시 DEFEAT 전이.
- 남은 스폰 타이머는 DEFEAT 진입 시 모두 취소 (`get_tree()` 타이머 강제 종료 또는 상태 플래그로 스폰 차단).
- **구현 패턴**: `_is_active = false` 플래그를 두어 DEFEAT 시 모든 시그널 핸들러가 early return.

---

### EC-7: 보스 웨이브에서 보스가 목표 도달 (탈출)

**시나리오**: 보스가 사망하지 않고 경로 끝에 도달한 경우.

**처리 규칙**:
- 보스의 `reached_goal` 시그널 발행 → `lives -= enemy_unit.lives_damage` (보스 기본값 5).
- 일반 적 탈출과 동일한 흐름. 단, `boss_escaped` 시그널 추가 발행 (AudioSystem, VFX 용).
- 보스 체력바 UI는 `unit_died` 또는 `boss_escaped` 중 하나에서 비활성화.

---

## 6. Dependencies

### 업스트림 의존성 (WaveDefenseSystem이 호출/수신)

| 시스템 | 인터페이스 | 방향 |
|--------|---------|------|
| **DataManager** | `get_waves(stage_id)`, `get_stage(stage_id)`, `get_wave(stage_id, wave_index)` | WDS → DataManager |
| **EnemyPathSystem** | `spawn_enemy(enemy_id, path_node, delay)` 호출, `reached_goal(enemy_unit)` 시그널 수신 | 양방향 |
| **PlacementSystem** | `placement_ready` 시그널 수신, `set_placement_locked(bool)` 호출 | 양방향 |
| **CombatSystem** | `unit_died(enemy_unit)` 시그널 수신 | CombatSystem → WDS |
| **EconomyManager** | `earn_gold(amount, source)`, `calculate_wave_reward(stage_id, wave_index)`, `grant_stage_clear_reward(stage_id, stars)`, `roll_wave_shard_drop(stage_id, wave_index)` 호출 | WDS → EconomyManager |
| **InputControl** | `pause_requested`, `speed_2x_toggled(bool)` 시그널 수신 | InputControl → WDS |

### 다운스트림 의존성 (WaveDefenseSystem의 시그널을 다른 시스템이 수신)

| 시스템 | 수신 시그널 | 용도 |
|--------|-----------|------|
| **Battle HUD** | `wave_changed`, `lives_changed`, `wave_state_changed`, `prep_timer_tick`, `boss_spawned`, `stage_cleared`, `stage_failed` | 모든 전투 UI 갱신 |
| **VFX System** | `boss_wave_started`, `boss_killed`, `boss_escaped` | 보스 연출 이펙트 |
| **Audio System** | `boss_wave_started`, `boss_killed`, `stage_cleared`, `stage_failed` | BGM 전환, 효과음 |
| **Stage Progression** | `stage_cleared(stars, lives, time)` | 별점 기록, 다음 스테이지 해금 |

### 역방향 의존성 메모 (다른 GDD에 명시 요망)

이 문서에서 발생한 인터페이스 추가 사항으로, 아래 GDD에 역방향 의존성이 기록되어야 한다:

- `enemy-path-ai.md`: WaveDefenseSystem이 `spawn_enemy()` 호출자임을 명시
- `hero-placement.md`: WaveDefenseSystem이 `set_placement_locked()` 호출자임을 명시
- `combat-damage.md`: `unit_died` 시그널 수신자로 WaveDefenseSystem 추가
- `economy.md`: `calculate_wave_reward`, `grant_stage_clear_reward`, `roll_wave_shard_drop` API 추가 필요

---

## 7. Tuning Knobs

### 핵심 튜닝 파라미터 (economy.json / stages.json / waves.json)

| 파라미터 | 현재 기본값 | 안전 범위 | 위치 | 게임플레이 영향 |
|---------|-----------|---------|------|--------------|
| `MAX_LIVES` | 20 | 10 ~ 30 | stages.json (스테이지별) 또는 WaveDefenseSystem 상수 | 낮을수록 긴장감 높고 초보자 접근성 낮아짐. 20이 캐주얼-하드 균형점 |
| `STAR_2_LIVES_THRESHOLD` | 15 | 10 ~ 18 | stages.json 또는 balance_config | 2성 조건. 낮을수록 2성 달성이 쉬워짐. 너무 낮으면 3성 동기 감소 |
| `PREP_DURATION` | 5.0초 | 3.0 ~ 10.0초 | economy.json 또는 WaveDefenseSystem 상수 | 웨이브 간 숨 고르기. 너무 짧으면 압박감 과도, 너무 길면 지루함 |
| `CLEAR_ANIMATION_DURATION` | 1.5초 | 0.5 ~ 3.0초 | WaveDefenseSystem 상수 | 클리어 연출 길이. 너무 길면 흐름 끊김 |
| `spawn_delay` (waves.json) | 1.0초 (기본) | 0.3 ~ 3.0초 | waves.json 각 그룹 | 낮을수록 한꺼번에 몰려옴 → 압박감. 높을수록 여유 있지만 지루함 |
| `group_delay` (waves.json) | 0.0 ~ 5.0초 (파도마다 상이) | 0.0 ~ 10.0초 | waves.json 각 그룹 | 그룹 간 간격. 다중 경로 동시 압박 vs 순차 압박 제어 |
| `boss_lives_damage` | 5 | 2 ~ 10 | enemies.json (보스 유닛) | 보스 탈출의 치명도. 5이면 한 번 탈출 시 15 → 10으로 2성 위기 |
| `base_wave_gold` | 120 | 80 ~ 200 | economy.json | 파밍 속도 제어. 높이면 강화가 빨라지고 게임이 쉬워짐 |
| `base_stage_clear_gold` | 400 | 200 ~ 800 | economy.json | 스테이지 단위 성취감. 웨이브 보상 총합 대비 10~20% 권장 |

### 튜닝 우선순위 가이드

1. **첫 플레이테스트 후**: `spawn_delay`와 `group_delay` 미세 조정으로 웨이브 난이도 조정
2. **목숨 소비가 너무 빠름**: `MAX_LIVES` 상향 또는 보스 `lives_damage` 하향
3. **3성 달성이 너무 쉬움**: `MAX_LIVES` 하향 또는 보스 `lives_damage` 상향
4. **골드 부족 → 강화 못 함**: `base_wave_gold` 상향, 플레이어 좌절 방지
5. **골드 과잉 → 강화가 쉬움**: `base_wave_gold` 하향, 긴장감 회복

---

## 8. Acceptance Criteria

### AC-1: 상태 기계 전이

- [ ] 스테이지 씬 로드 후 WaveDefenseSystem이 PLACEMENT 상태임을 확인
- [ ] `placement_ready` 시그널 발행 시 자동으로 첫 웨이브 PREP 상태로 전이됨
- [ ] PREP 상태에서 5초 후 (또는 "다음 웨이브" 버튼 클릭 시) SPAWNING으로 전이됨
- [ ] SPAWNING 상태에서 모든 적 스폰 완료 후 ACTIVE로 전이됨
- [ ] ACTIVE 상태에서 모든 적이 사망/도달 후 CLEARED로 전이됨
- [ ] 마지막 웨이브 CLEARED 후 VICTORY 상태로 전이되고 `stage_cleared` 시그널 발행됨
- [ ] 어느 상태에서든 lives == 0이 되면 즉시 DEFEAT 전이됨

### AC-2: 스폰 타이밍

- [ ] 2개 그룹, group_delay = 3.0초 설정 시: 그룹 2의 첫 번째 적이 3.0초 이후에 스폰됨 (±0.1초 허용)
- [ ] spawn_delay = 1.0초, count = 5 설정 시: 5번째 적이 4.0초에 스폰됨 (±0.1초 허용)
- [ ] 일시정지 후 재개 시 스폰 타이머가 남은 시간부터 재개됨

### AC-3: 생명력 시스템

- [ ] 적 1마리 목표 도달 시 lives가 정확히 1 감소함 (기본 lives_damage = 1)
- [ ] 보스 목표 도달 시 lives가 enemies.json의 `lives_damage` 값만큼 감소함
- [ ] lives가 0이 되는 순간 즉시 stage_failed 시그널이 발행됨
- [ ] lives가 0 미만으로 내려가지 않음 (clamp 처리)

### AC-4: 웨이브 완료 감지 오탐 방지

- [ ] SPAWNING 중 순간적으로 active_enemies가 비어도 CLEARED로 전이되지 않음
- [ ] 마지막 적이 사망과 동시에 목표 도달 시 중복 보상 없이 CLEARED 1회만 발행됨

### AC-5: 별점 산정

- [ ] lives == 20으로 클리어 시 3성 반환됨
- [ ] lives == 15으로 클리어 시 2성 반환됨
- [ ] lives == 14로 클리어 시 1성 반환됨
- [ ] lives == 1로 클리어 시 1성 반환됨

### AC-6: 보상 지급

- [ ] 적 사망 즉시 EconomyManager.earn_gold가 해당 적의 reward_gold로 호출됨
- [ ] 웨이브 CLEARED 진입 시 EconomyManager.calculate_wave_reward가 1회 호출됨
- [ ] VICTORY 진입 시 EconomyManager.grant_stage_clear_reward가 별점 파라미터와 함께 1회 호출됨
- [ ] 동일 웨이브에서 보상이 2회 지급되지 않음

### AC-7: 일시정지 / 2배속

- [ ] 일시정지 버튼 클릭 시 SceneTree.paused == true이고 적 이동이 멈춤
- [ ] 2배속 토글 시 Engine.time_scale == 2.0이고 적 이동 속도가 눈에 띄게 빨라짐
- [ ] PREP 상태에서 2배속 버튼이 비활성화됨
- [ ] 2배속 중 일시정지 시 정상적으로 멈춤; 재개 시 2배속 유지됨

### AC-8: 보스 웨이브

- [ ] is_boss_wave == true인 웨이브 진입 시 boss_wave_started 시그널 발행됨
- [ ] 보스 스폰 후 boss_spawned(enemy_unit) 시그널이 발행됨
- [ ] 보스 사망 시 boss_killed 시그널 발행됨
- [ ] 보스 목표 도달 시 boss_escaped 시그널 발행됨

### AC-9: UI 데이터 시그널

- [ ] 웨이브 전환 시마다 wave_changed(wave_index, total_waves) 시그널 발행됨
- [ ] lives 변화 시마다 lives_changed(lives) 시그널 발행됨
- [ ] PREP 상태에서 prep_timer_tick이 매 프레임 발행됨
