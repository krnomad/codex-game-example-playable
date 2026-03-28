# 영웅 배치 (Hero Placement)

> **Status**: Designed
> **Author**: systems-designer + user
> **Last Updated**: 2026-03-28
> **Implements Pillar**: 배치 전략 (전투 전/중 영웅 포진, 드래그앤드롭 인터랙션)

---

## Overview

풍운지기의 영웅 배치 시스템은 플레이어가 전투 준비 단계에서 스테이지 씬에 사전 정의된
배치 슬롯에 영웅을 배치하고, 전투 중에도 제한적으로 재배치할 수 있는 전략적 포진 시스템이다.
슬롯은 각 스테이지 씬 파일의 `Marker2D` 노드로 정의되며, 최대 8개 영웅을 동시에 전장에
배치할 수 있다. 드래그앤드롭 또는 탭-투-플레이스 방식으로 영웅 패널에서 슬롯으로 영웅을
이동시키며, 배치된 영웅의 `slot_position`이 HeroUnit에 주입되면 전투/데미지 시스템과
스킬 발동 시스템이 이 값을 사거리 판정 및 영역 타겟팅에 사용한다.

---

## Player Fantasy

> "화면 하단에 내 영웅들이 줄지어 있다. +9 궁수의 푸른 오라가 빛난다.
> 나는 그 영웅을 집어서 경로가 꺾이는 코너 슬롯에 내려놓는다.
> 슬롯이 황금빛으로 반짝이며 수락 신호를 보낸다 — 완벽한 포지션.
> +7 도사를 그 뒤에, +5 무사를 입구에 배치한다.
> 웨이브 시작 버튼을 누르는 순간, 내가 설계한 방어선이 살아 숨쉬기 시작한다."

플레이어가 원하는 감각:
- **전략적 통제감**: 어느 슬롯에 어느 영웅을 놓느냐가 승패를 가른다는 확신
- **즉각적 피드백**: 드래그하는 동안 슬롯이 반응하고, 강화 오라가 미리 보인다
- **명확한 허용/거부**: 배치 불가 슬롯은 붉게 표시되어 혼란이 없다
- **배치의 무게감**: 전투가 시작된 후 위치 변경에는 대가가 따른다는 긴장감

---

## Detailed Design

### 슬롯 시스템 (Slot System)

#### 슬롯 정의

슬롯은 각 스테이지 씬(`.tscn`)에 `Marker2D` 노드로 배치된다.
씬 계층 구조:

```
StageScene (Node2D)
├── Background
├── EnemyPath (Path2D)
├── HeroSlots (Node2D)          ← 슬롯 컨테이너
│   ├── Slot_01 (Marker2D)      ← 슬롯 노드
│   ├── Slot_02 (Marker2D)
│   ├── ...
│   └── Slot_N (Marker2D)       ← N: 스테이지별 상이 (최대 8)
└── HUD (CanvasLayer)
```

#### 슬롯 노드 메타데이터

각 `Marker2D` 노드는 다음 커스텀 메타데이터(Godot Inspector)를 가진다:

| 메타 키 | 타입 | 예시값 | 설명 |
|--------|------|--------|------|
| `slot_id` | String | `"slot_01"` | 배치 시스템이 HeroUnit에 주입하는 ID |
| `slot_index` | int | `1` | 정렬/표시 순서 |
| `is_enabled` | bool | `true` | false이면 잠긴 슬롯 (진행 해금 등) |

**슬롯 역할 제한 없음 (MVP)**: 모든 영웅은 모든 슬롯에 배치 가능하다.
슬롯 타입 제한(예: "원거리 전용")은 post-MVP 확장 항목으로 유보한다.

#### PlacementSlot 런타임 객체

`PlacementSystem`이 씬 로드 시 각 `Marker2D`를 순회하며 런타임 슬롯 상태를 딕셔너리로 관리한다.

```gdscript
# PlacementSystem 내부 슬롯 레지스트리
var _slots: Dictionary = {
    "slot_01": {
        "slot_id":       "slot_01",
        "world_position": Vector2,   # Marker2D.global_position
        "is_enabled":    bool,
        "occupant":      HeroUnit,   # null이면 빈 슬롯
    },
    ...
}
```

---

### 영웅 패널 (Hero Selection Panel)

전투 준비 단계에서 화면 하단에 표시되는 영웅 목록 UI.

#### 패널 구성

- **표시 대상**: 플레이어가 보유한 영웅 전체 (스테이지 진입 전 팀 편성에서 선택한 최대 8인)
- **카드 크기**: 64×64 게임 픽셀 (터치 타겟 80px 이상을 위해 히트 영역 80×80)
- **카드 내용**: 영웅 스프라이트(32×32) + 강화 레벨 표기(`+7`) + 강화 오라 미니 프리뷰
- **패널 가시성**: 전투 준비 단계에서는 항상 표시, 웨이브 진행 중에는 반투명(alpha 0.7) 유지

#### 카드 상태

| 상태 | 시각 표현 | 조건 |
|------|----------|------|
| `AVAILABLE` | 정상 표시 | 아직 배치되지 않음 |
| `PLACED` | 반투명 + 슬롯 번호 오버레이 | 이미 전장에 배치됨 |
| `DRAGGING` | 패널에서 페이드아웃, 드래그 고스트 표시 | 드래그 중 |
| `SELECTED` | 테두리 황금빛 하이라이트 | 탭-투-플레이스 1단계 |

---

### 드래그앤드롭 배치 흐름 (Drag-and-Drop Flow)

InputManager의 시그널만 소비한다. raw input을 직접 처리하지 않는다.

#### 플로우 다이어그램

```
[패널 카드 위에서 drag_started]
        │
        ▼
[드래그 고스트 스프라이트 생성]
[패널 카드 DRAGGING 상태로 전환]
[모든 슬롯 하이라이트 활성화]
        │
        ▼ drag_updated (매 프레임)
[드래그 고스트 위치 갱신]
[커서 아래 슬롯 감지 → 하이라이트 갱신]
        │
        ├──── 빈 슬롯 위: 녹색 하이라이트
        ├──── 점유 슬롯 위: 노란 하이라이트 (교체 가능)
        └──── 잠긴 슬롯 위: 빨간 하이라이트
        │
        ▼ drag_ended
[커서 위치 → 유효 슬롯 판정]
        │
        ├─ 유효 슬롯(빈/교체): _place_hero() 호출
        └─ 유효 슬롯 없음: 고스트 패널로 복귀 애니메이션
        │
[드래그 고스트 제거]
[모든 슬롯 하이라이트 초기화]
```

#### 드래그 히트 감지

drag_ended 시 커서 위치에서 슬롯을 찾는 방식:

```
drop_slot = null
for slot_id in _slots:
    var slot = _slots[slot_id]
    if not slot.is_enabled: continue
    if slot.world_position.distance_to(drop_position) <= SLOT_HIT_RADIUS:
        drop_slot = slot
        break
```

`SLOT_HIT_RADIUS` 기본값: **40px** (게임 좌표). 슬롯 간격이 최소 80px 이상이면 중복 감지 없음.

---

### 탭-투-플레이스 대안 (Tap-to-Place Alternative)

드래그가 어려운 환경(소형 화면, 정밀 조작 불편)을 위한 대안 입력 방식.

#### 2단계 탭 플로우

```
1단계: [영웅 카드 tapped]
       → 해당 카드 SELECTED 상태
       → 모든 슬롯 하이라이트 활성화
       → PlacementSystem: _pending_hero = hero

2단계: [슬롯 영역 tapped]
       → _pending_hero 유효 여부 확인
       → 유효: _place_hero(_pending_hero, slot) 호출
       → _pending_hero = null, 하이라이트 초기화

취소: [빈 공간 또는 다른 카드 tapped]
       → 1단계로 돌아가거나 다른 영웅 선택
```

#### 우선순위 규칙

드래그와 탭-투-플레이스는 상호 배타적:
- `drag_started`가 감지되면 탭-투-플레이스 `_pending_hero`를 자동 취소
- 탭-투-플레이스 진행 중 드래그 시작 → `_pending_hero = null`, 드래그 모드로 전환

---

### 슬롯 배치 실행 (_place_hero)

```gdscript
func _place_hero(hero: HeroUnit, slot: Dictionary) -> void:
    # 1. 교체 판정: 슬롯에 기존 영웅이 있으면 패널로 반환
    if slot.occupant != null:
        _return_hero_to_panel(slot.occupant)

    # 2. 영웅의 이전 슬롯 비우기 (재배치인 경우)
    if hero.slot_id != "":
        _slots[hero.slot_id].occupant = null

    # 3. HeroUnit에 슬롯 정보 주입 (Unit Base 계약)
    hero.slot_id       = slot.slot_id
    hero.slot_position = slot.world_position
    hero.world_position = slot.world_position
    hero.global_position = slot.world_position

    # 4. 레지스트리 갱신
    slot.occupant = hero

    # 5. 패널 카드 PLACED 상태로 전환
    _hero_panel.set_card_state(hero.unit_id, HeroCardState.PLACED)

    # 6. 배치 이벤트 발행
    hero_placed.emit(hero, slot.slot_id)
```

---

### 배치 단계 (Placement Phases)

#### 전투 준비 단계 (Pre-Battle Phase)

- 웨이브 시작 버튼을 누르기 전 상태
- 모든 슬롯 자유롭게 배치/재배치 가능
- 영웅 패널 완전 활성화, InputManager ENABLED
- 이 단계에서 배치된 영웅 수 = 0 이면 웨이브 시작 버튼 비활성화

#### 웨이브 진행 중 배치 (Mid-Battle Placement)

MVP 정책: **웨이브 진행 중 배치 변경 허용** (무료, 제한 없음).

설계 근거:
- 모바일 웹 타겟 특성상 빠른 포진 변경이 전략 핵심 재미 제공
- 웨이브 중 변경 비용 시스템(골드/쿨다운)은 post-MVP 확장으로 유보
- USING_SKILL 상태 영웅의 위치 변경: `slot_position`은 즉시 갱신되나
  현재 스킬 모션은 완료 후 다음 공격부터 새 위치 기준 적용

#### 전투 종료 후

전투 씬 종료 시 `PlacementSystem.cleanup()`이 모든 HeroUnit의 `slot_id` 및
`slot_position`을 초기화(`""`, `Vector2.ZERO`)하고 씬에서 제거한다.

---

### 영웅 제거/교체 (Hero Removal and Swap)

#### 슬롯에서 제거

배치된 영웅 카드를 패널 방향으로 드래그하면 슬롯에서 제거, 패널로 반환.
또는 이미 배치된 슬롯에 다른 영웅을 드롭하면 기존 영웅이 자동으로 패널로 반환됨.

#### 골드 비용

MVP: 배치/제거/교체 모두 **무료**.
post-MVP: 웨이브 중 재배치에 골드 비용 부과 검토.

---

### 동시 배치 한도 (Max Heroes Limit)

- 전장 동시 배치 최대: **8명**
- 슬롯 수가 8개 미만인 스테이지에서는 슬롯 수가 실질적 한도
- 8명이 모두 배치된 상태에서 추가 배치 시도:
  - 드래그앤드롭: 드래그 고스트는 허용, drop 시 "슬롯이 없음" 처리로 복귀
  - 탭-투-플레이스: 1단계 카드 선택은 허용, 2단계 슬롯 탭 시 "배치 공간 없음" 토스트 표시

---

### 슬롯 시각 피드백 (Slot Visual Feedback)

#### 드래그 중 슬롯 하이라이트 상태

| 상태 | 색상 | 조건 |
|------|------|------|
| `IDLE` | 없음 (슬롯 기본 외곽선만) | 드래그 비활성 |
| `VALID_EMPTY` | 녹색 (#4CAF50, alpha 0.6) | 드래그 활성, 빈 슬롯 |
| `VALID_SWAP` | 노란 (#FFC107, alpha 0.6) | 드래그 활성, 교체 가능한 점유 슬롯 |
| `INVALID` | 빨간 (#F44336, alpha 0.6) | 잠긴 슬롯 (`is_enabled = false`) |
| `HOVER` | 흰색 테두리 두께 2배 | 커서가 해당 슬롯 위에 있음 |

하이라이트는 `CanvasItem.draw_*` 또는 별도 `ColorRect` 노드로 구현.
픽셀 아트 스타일 유지를 위해 안티앨리어싱 없는 사각형 하이라이트 사용.

#### 강화 오라 미리보기

드래그 고스트 스프라이트는 실제 전장에 배치된 후와 동일한 강화 오라 이펙트를 표시.
오라 레벨별 시각 표현은 `art-direction.md` 기준을 따른다.

---

### PlacementSystem 아키텍처 요약

```
PlacementSystem (Node — 스테이지 씬의 자식)
├── 시그널 구독: InputManager.tapped, drag_started, drag_updated, drag_ended
├── 슬롯 레지스트리: _slots (Dictionary)
├── 드래그 상태: _dragging_hero, _drag_ghost
├── 탭-투-플레이스 상태: _pending_hero
└── 발행 시그널:
    ├── hero_placed(hero: HeroUnit, slot_id: String)
    ├── hero_removed(hero: HeroUnit, slot_id: String)
    └── placement_ready(placed_count: int)   ← 웨이브 시작 버튼 활성화 판단용
```

PlacementSystem은 스테이지 씬 로컬 노드이며, 오토로드 싱글톤이 아니다.
씬 전환 시 자동 소멸.

---

## Formulas

### 슬롯 히트 판정

```
is_hit = drop_position.distance_to(slot.world_position) <= SLOT_HIT_RADIUS
```

| 변수 | 값 | 설명 |
|------|-----|------|
| `SLOT_HIT_RADIUS` | 40px | 드롭 판정 반경 (게임 좌표) |
| `drop_position` | `drag_ended` 이벤트의 `position` | 커서/손가락 최종 위치 |
| `slot.world_position` | Marker2D.global_position | 슬롯 중심 좌표 |

**안전 조건**: 슬롯 간 최소 간격 `>= SLOT_HIT_RADIUS × 2 = 80px`
이 조건이 지켜지면 동시에 두 슬롯이 hit 판정을 받는 경우가 없다.

### 동시 배치 수 확인

```
placed_count = _slots.values().filter(func(s): return s.occupant != null).size()
can_place_more = placed_count < MAX_HEROES
```

| 변수 | 값 | 설명 |
|------|-----|------|
| `MAX_HEROES` | 8 | 동시 배치 최대 영웅 수 |
| `placed_count` | 0 ~ 8 | 현재 전장에 배치된 영웅 수 |
| `can_place_more` | bool | 추가 배치 허용 여부 |

### 카드 터치 히트 판정

```
is_card_tapped = tap_position.distance_to(card_center) <= CARD_HIT_RADIUS
CARD_HIT_RADIUS = 40px
```

패널 카드는 64×64 표시이나, 히트 영역은 반경 40px 원 (= 80px 지름, Input/Control 기준 준수).

---

## Edge Cases

| 상황 | 처리 |
|------|------|
| **모든 슬롯이 꽉 찬 상태에서 드래그** | 드래그 고스트 표시는 허용. drop 시 유효 슬롯(교체 대상)에만 배치 허용. 빈 슬롯 없으므로 VALID_EMPTY 하이라이트 없음 |
| **드래그 중 브라우저 포커스 상실** | InputManager가 `drag_ended(cancelled=true)` 발신 → 고스트 즉시 제거, 드래그 중이던 영웅 패널로 복귀, 슬롯 하이라이트 전부 초기화 |
| **드래그 취소 (유효 슬롯 밖 드롭)** | 고스트가 패널 카드 위치로 복귀 트윈 애니메이션 (0.15초) 재생. 카드 상태 `AVAILABLE` 복원 |
| **웨이브 진행 중 배치 변경** | USING_SKILL 상태 영웅: slot_position 즉시 갱신, 현재 스킬 모션은 계속, 다음 공격부터 새 위치 기준 적용. ATTACKING 상태: 즉시 갱신, 공격 타이머 리셋 없음 |
| **STUNNED 영웅 재배치** | 허용. slot_position 갱신 후 STUNNED 타이머 계속 소진 (Unit Base 계약) |
| **같은 슬롯에 같은 영웅 다시 드롭** | `slot.occupant == hero` 감지 → 아무 변화 없이 고스트 복귀. `hero_placed` 시그널 미발행 |
| **모바일에서 슬롯 겹침 (핀치 오작동)** | InputManager의 멀티터치 무시 정책에 의해 index > 0 입력 차단. 단일 터치만 처리되므로 겹침 판정 없음 |
| **영웅 패널 밖에서 drag_started** | `_drag_started_on_hero()` 진입 시 `drag_position`이 어느 카드에도 hit 없으면 무시 |
| **씬 전환 중 드래그 진행** | 씬 전환 시작 시 `InputManager.disable_input()` 호출 → 드래그 강제 취소 (Input/Control 계약) |
| **슬롯이 0개인 스테이지** | `PlacementSystem._ready()`에서 슬롯 미발견 시 `push_error()` + 웨이브 시작 버튼 비활성화 유지 |
| **잠긴 슬롯(is_enabled=false)에 드롭** | 드롭 판정 시 `is_enabled` 확인 → false이면 유효 슬롯에서 제외. 고스트 복귀 처리 |
| **배치 0명에서 웨이브 시작 시도** | `placement_ready(0)` 상태에서 시작 버튼 비활성화. 강제 진행 불가 |

---

## Dependencies

### 이 시스템이 의존하는 시스템 (Upstream)

| 시스템 | 의존 내용 | 인터페이스 |
|--------|----------|-----------|
| **Unit Base** | HeroUnit 인스턴스 생성/회수, `slot_id`/`slot_position` 주입 | `HeroUnit.slot_id`, `HeroUnit.slot_position`, `HeroUnit.world_position` |
| **Input/Control** | 드래그앤드롭 및 탭 입력 신호 수신 | `InputManager.tapped`, `drag_started`, `drag_updated`, `drag_ended` |
| **Data Config** | 영웅 정의(heroes.json) — 패널 카드 구성, 스프라이트 ID | `DataManager.get_hero(unit_id)` |

### 이 시스템에 의존하는 시스템 (Downstream)

| 시스템 | 의존 내용 | 인터페이스 |
|--------|----------|-----------|
| **Wave Defense** | 웨이브 시작 전 배치된 영웅 목록 및 위치 조회 | `PlacementSystem.get_placed_heroes() -> Array[HeroUnit]`, `hero_placed` 시그널 |
| **Combat / Damage** | 영웅의 사거리 판정 기준 좌표 | `HeroUnit.slot_position` (읽기 전용) |
| **Battle HUD** | 배치 UI 슬롯 하이라이트, 카드 상태 표시 | `hero_placed`, `hero_removed`, `placement_ready` 시그널 |
| **Skill Activation** | 영역 스킬의 발사 기준 좌표 | `HeroUnit.slot_position` (읽기 전용) |

### 양방향 계약 요약

```
InputManager ──(시그널)──▶ PlacementSystem ──(slot_position 주입)──▶ HeroUnit
                                 │
                    (시그널)──▶ WaveDefense
                    (시그널)──▶ BattleHUD
                    (읽기)───▶ Combat
                    (읽기)───▶ SkillActivation
```

---

## Tuning Knobs

| 파라미터 | 기본값 | 안전 범위 | 게임플레이 영향 |
|---------|--------|----------|--------------|
| `MAX_HEROES` | 8 | 4 ~ 8 | 낮추면 전략 자유도 감소, 높이면 프레임 부하 증가 (Combat 루프 반복 횟수 직결) |
| `SLOT_HIT_RADIUS` | 40px | 24 ~ 56px | 낮추면 정밀한 드롭 필요, 높이면 인접 슬롯 오입력 위험 |
| `CARD_HIT_RADIUS` | 40px | 30 ~ 50px | Input/Control `min_touch_target` 기준(80px 지름) 하한 유지 |
| `SLOT_MIN_SPACING` | 80px | 64 ~ 128px | 낮추면 슬롯 밀집 가능하나 히트 감지 중복 위험, 스테이지 디자인 제약 |
| `DRAG_GHOST_ALPHA` | 0.85 | 0.5 ~ 1.0 | 드래그 중 고스트 투명도. 낮으면 슬롯 가시성 향상 |
| `GHOST_RETURN_DURATION` | 0.15s | 0.05 ~ 0.3s | 드래그 취소 시 복귀 애니메이션 시간. 길면 답답함 |
| `PANEL_WAVE_ALPHA` | 0.7 | 0.4 ~ 1.0 | 웨이브 진행 중 패널 투명도. 낮으면 전장 시야 확보, 높으면 조작성 유지 |
| `MID_BATTLE_PLACEMENT` | true (허용) | true/false | false로 변경 시 웨이브 중 배치 잠금 (난이도 상향 변형 모드용) |

---

## Acceptance Criteria

### 슬롯 초기화

- [ ] 스테이지 씬 로드 시 모든 `Marker2D` 노드가 `_slots` 레지스트리에 등록된다
- [ ] 각 슬롯의 `world_position`이 해당 `Marker2D.global_position`과 일치한다
- [ ] `is_enabled = false` 슬롯은 INVALID(빨간) 하이라이트로 표시되며 드롭을 수락하지 않는다

### 드래그앤드롭 배치

- [ ] 영웅 카드 위에서 drag_started 시 드래그 고스트가 생성되고 패널 카드가 DRAGGING 상태로 전환된다
- [ ] drag_updated 마다 드래그 고스트가 커서 위치를 따라간다
- [ ] 고스트가 빈 슬롯 위에 있을 때 해당 슬롯이 VALID_EMPTY(녹색) 하이라이트로 표시된다
- [ ] 고스트가 점유 슬롯 위에 있을 때 해당 슬롯이 VALID_SWAP(노란) 하이라이트로 표시된다
- [ ] drag_ended 시 유효 슬롯 위이면 `_place_hero()`가 호출되고 `hero_placed` 시그널이 발행된다
- [ ] drag_ended 시 유효 슬롯 밖이면 드래그 고스트가 패널 카드 위치로 0.15초 내 복귀한다
- [ ] 배치 후 HeroUnit의 `slot_id`와 `slot_position`이 해당 슬롯 값으로 정확히 설정된다
- [ ] 배치 후 `HeroUnit.global_position`이 슬롯의 `world_position`과 일치한다

### 탭-투-플레이스

- [ ] 영웅 카드 탭 시 카드가 SELECTED 상태로 전환되고 슬롯 하이라이트가 활성화된다
- [ ] SELECTED 상태에서 유효 슬롯 탭 시 `_place_hero()`가 호출된다
- [ ] SELECTED 상태에서 drag_started 발생 시 `_pending_hero`가 null로 초기화된다
- [ ] 빈 공간 탭 시 SELECTED 상태가 해제되고 하이라이트가 초기화된다

### 교체 및 제거

- [ ] 점유된 슬롯에 새 영웅 드롭 시 기존 영웅이 패널로 반환되고 새 영웅이 해당 슬롯에 배치된다
- [ ] 패널로 반환된 영웅의 `slot_id`가 `""`로 초기화된다
- [ ] 같은 슬롯에 같은 영웅 재드롭 시 `hero_placed` 시그널이 발행되지 않는다

### 최대 배치 한도

- [ ] 8명이 배치된 상태에서 드래그 시 기존 슬롯 교체만 허용되고 새 빈 슬롯 드롭은 거부된다
- [ ] `placed_count`가 항상 0 ~ 8 범위를 유지한다

### 웨이브 시작 조건

- [ ] 배치 영웅 수가 0명이면 웨이브 시작 버튼이 비활성화된다 (`placement_ready(0)` 상태)
- [ ] 1명 이상 배치되면 `placement_ready(N)` 시그널이 발행되고 웨이브 시작 버튼이 활성화된다

### 취소 및 에러 처리

- [ ] `drag_ended(cancelled=true)` 수신 시 드래그 고스트가 즉시 제거되고 카드가 AVAILABLE로 복원된다
- [ ] 슬롯 수가 0개인 씬에서 `push_error()`가 호출되고 배치 시스템이 크래시 없이 대기 상태를 유지한다
- [ ] `DataManager.get_hero()` 실패 시 카드 생성이 건너뛰어지고 `push_error()`가 호출된다

### 성능

- [ ] 8명 배치 상태에서 드래그 중 매 프레임 슬롯 히트 감지가 0.5ms 이하이다
- [ ] 드래그 고스트 스프라이트가 60fps에서 드롭 없이 유지된다 (draw call 1개 추가)
