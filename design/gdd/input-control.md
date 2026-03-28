# Input/Control (입력 제어)

> **Status**: Designed
> **Author**: systems-designer + user
> **Last Updated**: 2026-03-28
> **Implements Pillar**: 전체 (모든 인터랙티브 시스템의 입력 기반)

---

## Overview

마우스(PC)와 터치(모바일 브라우저)를 단일 추상화 레이어로 통합하는 입력 관리 시스템이다.
InputManager 오토로드 싱글톤이 Godot의 raw input 이벤트를 소비하여
`tapped`, `drag_started`, `drag_updated`, `drag_ended` 4개 시그널로 변환한다.
모든 게임플레이 시스템(배치, HUD, 강화 UI 등)은 이 시그널만 구독하며,
입력 장치 종류를 알 필요가 없다.

## Player Fantasy

이 시스템은 **개발 인프라**다. 플레이어가 직접 인식하지 않지만,
"영웅을 드래그해서 슬롯에 배치하고, 스킬 버튼을 탭하고, 강화 UI를 조작하는"
모든 상호작용이 자연스럽고 반응성 있게 느껴지려면 이 시스템이 견고해야 한다.

**디자이너/개발자 판타지**: "입력 처리 코드를 한 곳에서만 관리하면
PC와 모바일 브라우저 모두에서 동일한 조작감을 보장할 수 있다."

---

## Detailed Design

### Core Rules

#### InputManager 오토로드

```
InputManager (Node — Autoload Singleton)
├── state: InputState (ENABLED / DISABLED / DRAG_ACTIVE)
├── drag_threshold: float = 8.0  # 픽셀 단위
├── _press_position: Vector2     # 터치/클릭 시작 좌표
├── _press_time: float           # 터치/클릭 시작 시간
├── _is_pressed: bool
├── _current_drag_data: Variant  # 드래그 중인 오브젝트 정보
```

#### 입력 처리 흐름

1. **Press 감지**: `_unhandled_input(event)`에서 마우스 왼쪽 클릭 또는 터치(index=0)의 pressed 이벤트 수신
2. **위치 기록**: `_press_position`과 `_press_time` 저장, `_is_pressed = true`
3. **이동 감지**: 이후 motion 이벤트에서 `_press_position`으로부터의 이동 거리 계산
4. **분기 판정**:
   - 이동 거리 < `drag_threshold` 상태에서 release → **Tap** 판정 → `tapped` 시그널 발신
   - 이동 거리 ≥ `drag_threshold` → **Drag 시작** → `state = DRAG_ACTIVE`, `drag_started` 시그널 발신
5. **드래그 진행**: `DRAG_ACTIVE` 상태에서 motion → `drag_updated` 시그널 발신 (매 프레임)
6. **드래그 종료**: `DRAG_ACTIVE` 상태에서 release → `drag_ended` 시그널 발신, `state = ENABLED`

#### 시그널 정의

| Signal | Parameters | 발신 조건 |
|--------|-----------|----------|
| `tapped` | `position: Vector2` | 드래그 임계값 미만에서 release |
| `drag_started` | `position: Vector2, start_position: Vector2` | 이동 거리 ≥ drag_threshold |
| `drag_updated` | `position: Vector2, delta: Vector2` | DRAG_ACTIVE 중 매 motion |
| `drag_ended` | `position: Vector2, start_position: Vector2` | DRAG_ACTIVE 중 release |

#### 마우스/터치 통합 규칙

| 입력 | Godot 이벤트 | 매핑 |
|------|-------------|------|
| 마우스 왼쪽 클릭 | `InputEventMouseButton` (button_index=1) | Press/Release |
| 마우스 이동 (버튼 누른 채) | `InputEventMouseMotion` | Motion |
| 터치 시작 | `InputEventScreenTouch` (pressed=true, index=0) | Press |
| 터치 이동 | `InputEventScreenDrag` (index=0) | Motion |
| 터치 종료 | `InputEventScreenTouch` (pressed=false, index=0) | Release |

- **멀티터치 무시**: `index > 0`인 터치 이벤트는 전부 무시 (이 게임은 싱글터치만 사용)
- **마우스 오른쪽/중간 클릭**: 무시 (향후 확장 예약)

### States and Transitions

| 현재 상태 | 이벤트 | 다음 상태 | 동작 |
|----------|--------|----------|------|
| ENABLED | Press | ENABLED | `_press_position` 기록, `_is_pressed = true` |
| ENABLED (pressed) | Motion ≥ threshold | DRAG_ACTIVE | `drag_started` 발신 |
| ENABLED (pressed) | Release (< threshold) | ENABLED | `tapped` 발신 |
| DRAG_ACTIVE | Motion | DRAG_ACTIVE | `drag_updated` 발신 |
| DRAG_ACTIVE | Release | ENABLED | `drag_ended` 발신 |
| DRAG_ACTIVE | Focus Lost | ENABLED | `drag_ended(cancelled=true)` 발신 |
| DISABLED | 모든 입력 | DISABLED | 무시 (시그널 미발신) |

#### 상태 전환 API

```gdscript
func disable_input() -> void    # DISABLED로 전환, 진행 중 드래그 취소
func enable_input() -> void     # ENABLED로 전환
func is_drag_active() -> bool   # DRAG_ACTIVE 여부 반환
```

#### 입력 잠금 시나리오

| 시나리오 | 동작 |
|---------|------|
| 씬 전환 중 | `disable_input()` → 전환 완료 후 `enable_input()` |
| 강화 연출 재생 중 | `disable_input()` → 연출 완료 후 `enable_input()` |
| 웨이브 클리어 보상 팝업 | `disable_input()` → 팝업 닫힘 후 `enable_input()` |
| 포커스 상실 (탭 전환 등) | 진행 중 드래그 즉시 취소, `drag_ended(cancelled=true)` |

### Interactions with Other Systems

| 시스템 | 방향 | 인터페이스 |
|--------|------|-----------|
| **타워 배치 (Placement)** | → 소비 | `tapped` → 슬롯 선택, `drag_started/updated/ended` → 영웅 드래그 배치 |
| **전투 HUD** | → 소비 | `tapped` → 스킬 버튼 클릭, 일시정지 버튼 등 |
| **강화 UI** | → 소비 | `tapped` → 강화 버튼, 아이템 선택, UI 내비게이션 |
| **영웅 관리 UI** | → 소비 | `tapped` → 영웅 선택, 팀 편성 드래그 |
| **스테이지 선택 UI** | → 소비 | `tapped` → 스테이지 선택, 챕터 스크롤 |

**핵심 원칙**: InputManager는 raw 입력을 게임 시그널로 변환만 하며,
어떤 게임 오브젝트가 탭/드래그되었는지의 판단은 소비 시스템이 담당한다.
(예: Placement 시스템이 `tapped` 시그널의 position을 받아 해당 좌표의 슬롯을 찾음)

---

## Formulas

### 드래그 판정

```
drag_detected = distance(_press_position, current_position) >= drag_threshold
```

- `drag_threshold` 기본값: **8.0px** (게임 해상도 960x540 기준)
- 모바일에서는 손가락 떨림 고려하여 물리 픽셀 기준이 아닌 게임 좌표 기준 적용

### 터치 영역 최소 크기

```
min_touch_target = 44px (물리 픽셀, Apple HIG 기준)
game_pixels_at_2x = 44 / 2 = 22px (게임 해상도 기준)
recommended_touch_target = 80px (게임 해상도) = 40px (물리, 2x 스케일) ← 안전 마진 포함
```

- UI 버튼: 최소 80×80 게임 픽셀 (2x 스케일 시 물리 40×40px)
- 슬롯/타일: 32×32 게임 픽셀이지만, 히트 영역은 40×40으로 확장 (인접 빈 공간 포함)

---

## Edge Cases

| 상황 | 처리 |
|------|------|
| 드래그 중 브라우저 포커스 상실 | `drag_ended(cancelled=true)` 즉시 발신, 드래그 오브젝트 원위치 |
| 드래그 중 게임 영역 밖으로 커서 이동 | Godot의 `NOTIFICATION_WM_MOUSE_EXIT` 감지 → 드래그 취소 |
| 매우 빠른 탭 (< 50ms) | 유효한 탭으로 처리 (최소 시간 제한 없음) |
| 드래그 threshold 경계 (정확히 8px) | `>=` 비교이므로 정확히 8px = 드래그 시작 |
| 동시에 두 손가락 터치 | index=0만 처리, index>0 무시 |
| DISABLED 상태에서 입력 | 모든 이벤트 무시, `_is_pressed` 갱신 안 함 |
| DISABLED 전환 시 드래그 진행 중 | 드래그 즉시 취소 (`drag_ended(cancelled=true)`) 후 DISABLED |
| 매우 느린 드래그 (press 후 10초 뒤 이동) | 시간 제한 없음, threshold만 적용 |

---

## Dependencies

| 시스템 | 방향 | 의존 유형 | 설명 |
|--------|------|----------|------|
| — | — | — | Foundation 레이어 — 상위 의존성 없음 |

**이 시스템에 의존하는 하위 시스템들:**

| 시스템 | 소비하는 시그널 |
|--------|--------------|
| 타워 배치 (Placement) | tapped, drag_started/updated/ended |
| 전투 HUD | tapped |
| 강화 UI | tapped |
| 영웅 관리 UI | tapped, drag_started/updated/ended |
| 스테이지 선택 UI | tapped |
| 튜토리얼 | 모든 시그널 (입력 가이드용) |

---

## Tuning Knobs

| 파라미터 | 기본값 | 안전 범위 | 영향 |
|---------|--------|----------|------|
| `drag_threshold` | 8.0px | 4~16px | 낮으면 의도치 않은 드래그, 높으면 드래그 반응 느림 |
| `min_touch_target` | 80px (게임) | 60~120px | 낮으면 모바일 조작 어려움, 높으면 UI 배치 제약 |
| `drag_update_rate` | 매 프레임 | 매 프레임~30Hz | 낮추면 CPU 절약, 드래그 부드러움 감소 |

---

## Acceptance Criteria

### 기본 동작
- [ ] PC에서 마우스 클릭 → `tapped` 시그널이 올바른 좌표와 함께 발신된다
- [ ] PC에서 마우스 드래그 → `drag_started` → `drag_updated` (N회) → `drag_ended` 순서로 발신된다
- [ ] 모바일 브라우저에서 터치 → 동일한 시그널이 동일한 순서로 발신된다
- [ ] 드래그 임계값(8px) 미만 이동 후 release → `tapped`으로 판정된다

### 상태 관리
- [ ] `disable_input()` 호출 시 모든 입력이 무시된다
- [ ] `enable_input()` 호출 시 입력이 다시 처리된다
- [ ] DISABLED 전환 시 진행 중 드래그가 `cancelled=true`로 종료된다

### 엣지 케이스
- [ ] 멀티터치 시 index=0만 처리되고 index>0은 무시된다
- [ ] 브라우저 포커스 상실 시 드래그가 자동 취소된다
- [ ] 게임 영역 밖 커서 이동 시 드래그가 취소된다

### 성능
- [ ] InputManager의 `_unhandled_input` 처리가 프레임당 0.1ms 이하이다
- [ ] 드래그 중 매 프레임 시그널 발신이 프레임 드롭을 유발하지 않는다
