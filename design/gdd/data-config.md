# Data Config (데이터 설정)

> **Status**: Designed
> **Author**: game-designer + systems-designer + user
> **Last Updated**: 2026-03-28
> **Implements Pillar**: 전체 (모든 밸런스의 원천)

## Overview

게임의 모든 밸런스 값(영웅 스탯, 적 스탯, 강화 확률/비용, 웨이브 구성, 스테이지 보상,
스킬 데이터 등)을 외부 JSON 데이터 파일로 관리하는 인프라 시스템이다.
코드 수정 없이 데이터 파일만 편집하면 밸런싱을 조정할 수 있으며,
모든 게임플레이 시스템이 이 데이터를 소비한다.
플레이어가 직접 상호작용하지 않지만, 게임의 모든 수치적 느낌을 결정하는 기반 계층이다.

## Player Fantasy

이 시스템은 플레이어 대면 시스템이 아닌 **개발 인프라**다.

**디자이너 판타지**: "코드를 건드리지 않고 JSON 파일 하나만 수정하면
영웅의 공격력, 강화 확률, 웨이브 난이도를 즉시 바꿀 수 있다.
밸런싱 이터레이션이 빌드 없이 가능하다."

---

## Detailed Design

### Core Rules

#### 파일 구성

```
assets/data/
├── heroes.json       # 영웅 정의 (4~12종)
├── enemies.json      # 적 유닛 정의 (6~8종 + 보스)
├── enhancement.json  # 강화 확률/비용/배율 테이블
├── waves.json        # 스테이지별 웨이브 구성
├── stages.json       # 스테이지 메타데이터 (해금, 별점 조건 등)
├── economy.json      # 경제 파라미터 (기본 보상, 비용 기준치)
├── items.json        # 아이템 정의 (보호 아이템, 강화석 등)
└── skills.json       # 스킬 정의 (모든 영웅 스킬)
```

**총 파일 크기 목표**: 합계 < 100KB

#### JSON 스키마 규약

모든 JSON 파일은 다음 규약을 따른다.

**최상위 구조**: 반드시 `meta` 객체와 데이터 키를 포함한다.

```json
{
  "meta": {
    "version": "1.0.0",
    "last_updated": "YYYY-MM-DD",
    "description": "파일 설명"
  },
  "<data_key>": { ... }
}
```

**ID 규약**:
- 모든 엔티티는 `id` 필드를 가지며, 영문 소문자 + 언더스코어만 허용 (`musa`, `fire_oni`)
- `id`는 파일 내에서 유일해야 하며, 크로스-레퍼런스 시 이 ID로 참조

**숫자 타입 규약**:
- 확률 값: `0.0 ~ 1.0` 범위의 float (55% → `0.55`)
- 배율: `1.0` 기준 float (1.05배 → `1.05`)
- 비용/수량: 양의 정수 (int)
- 쿨다운/시간: 초 단위 float

**열거형 값**: 대문자 + 언더스코어 (`"SAFE"`, `"DANGER"`, `"HELL"`, `"WARRIOR"`, `"ARCHER"`)

#### DataManager 오토로드 (GDScript)

**위치**: `src/core/data_manager.gd`
**오토로드 이름**: `DataManager`

동작 3단계:

1. **로드 단계** (`_ready()`): 8개 JSON 파일을 순서대로 읽어 메모리에 저장
2. **검증 단계** (`_validate_all()`): 필수 필드, 크로스-레퍼런스 무결성 확인
3. **서비스 단계**: 다른 시스템의 쿼리에 응답

**로드 순서** (의존성 순):
`economy.json` → `skills.json` → `items.json` → `heroes.json` → `enemies.json` → `enhancement.json` → `stages.json` → `waves.json`

로드 실패 시 `data_load_failed(file_name, error)` 시그널 발행, 게임 부트 차단.

**메모리 구조**:

```
_heroes:       Dictionary  # { "musa": {...}, "gungsu": {...} }
_enemies:      Dictionary  # { "fire_oni": {...}, ... }
_enhancement:  Dictionary  # { "levels": [...], "config": {...} }
_waves:        Dictionary  # { "stage_1": { "waves": [...] }, ... }
_stages:       Dictionary  # { "stage_1": {...}, ... }
_economy:      Dictionary  # { "gold": {...}, "stones": {...} }
_items:        Dictionary  # { "talisman_of_enhancement": {...}, ... }
_skills:       Dictionary  # { "musa_blade_storm": {...}, ... }
```

#### API 패턴

모든 외부 시스템은 아래 메서드로만 데이터에 접근한다.

```gdscript
# 영웅
DataManager.get_hero(hero_id: String) -> Dictionary
DataManager.get_all_heroes() -> Array[Dictionary]
DataManager.get_heroes_by_role(role: String) -> Array[Dictionary]

# 적
DataManager.get_enemy(enemy_id: String) -> Dictionary
DataManager.get_all_enemies() -> Array[Dictionary]

# 강화
DataManager.get_enhancement_level(level: int) -> Dictionary
DataManager.get_enhancement_table() -> Array[Dictionary]

# 웨이브/스테이지
DataManager.get_stage(stage_id: String) -> Dictionary
DataManager.get_waves(stage_id: String) -> Array[Dictionary]
DataManager.get_wave(stage_id: String, wave_index: int) -> Dictionary

# 경제/아이템/스킬
DataManager.get_economy_config() -> Dictionary
DataManager.get_item(item_id: String) -> Dictionary
DataManager.get_skill(skill_id: String) -> Dictionary

# 존재 확인
DataManager.hero_exists(hero_id: String) -> bool
DataManager.enemy_exists(enemy_id: String) -> bool
DataManager.skill_exists(skill_id: String) -> bool
DataManager.item_exists(item_id: String) -> bool
```

존재하지 않는 ID로 getter 호출 시 빈 `Dictionary {}` 반환 + `push_warning()`. null은 절대 반환하지 않는다.

#### Hot-Reload (개발 전용)

- 웹 빌드에서는 지원 안 함
- 데스크톱 디버그 빌드에서만 `DataManager.reload()` 수동 재로드 가능
- 재로드 시 이미 인스턴스화된 유닛 스탯에는 반영 안 됨 (다음 인스턴스부터 적용)

#### 로드 타이밍

| 타이밍 | 동작 |
|--------|------|
| 게임 시작 (`_ready`) | 8개 전체 로드 + 검증. 완료 전 게임 진행 차단 |
| 스테이지 진입 시 | 추가 로드 없음 (메모리 상주) |
| 게임 플레이 중 | 로드 없음. 조회만 발생 |

### States and Transitions

DataManager는 3가지 상태를 가진다.

| State | Entry Condition | Exit Condition | Behavior |
|-------|----------------|----------------|----------|
| `LOADING` | `_ready()` 호출 | 8개 파일 전부 로드 완료 | 파일 순서대로 읽기, 다른 시스템 접근 차단 |
| `VALIDATING` | 로드 완료 | 스키마 + 크로스레퍼런스 검증 완료 | 필수 필드/범위/ID 참조 검사 |
| `READY` | 검증 통과 | 게임 종료까지 유지 | 쿼리 서비스 (읽기 전용) |
| `ERROR` | 로드 실패 또는 검증 실패 | 없음 (복구 불가) | 에러 화면 표시, 쿼리 시 빈 Dict 반환 |

### Interactions with Other Systems

| 시스템 | 읽는 데이터 | 접근 패턴 | 읽는 시점 |
|--------|------------|----------|----------|
| 전투/데미지 | `heroes[id].base_stats`, `enhancement.levels[n]` 배율 | `get_hero()`, `get_enhancement_level()` | 영웅 인스턴스 생성 시 |
| 적 경로/AI | `enemies[id].stats`, `enemies[id].abilities` | `get_enemy()` | 적 스폰 시 |
| 타워 배치 | `heroes[id].role` | `get_hero()` | 배치 시 역할 확인 |
| 경제 | `economy` 전체 | `get_economy_config()` | 게임 초기화 시 1회 |
| 웨이브 방어 | `waves.stage_waves[stage_id]` | `get_waves()`, `get_wave()` | 스테이지 시작 시 |
| 스킬 발동 | `skills[id]` 전체 | `get_skill()` | 영웅 배치 확정 시 |
| 영웅 강화 | `enhancement.levels[n]`, `enhancement.config` | `get_enhancement_level()` | 강화 UI 열 때, 시도 직전 |
| 영웅 수집 | `heroes` 전체 | `get_all_heroes()` | 도감 화면 진입 시 |
| Item/Inventory | `items[id]` 전체 | `get_item()` | 아이템 획득/사용 시 |
| 스테이지 진행 | `stages[id]` 별점/보상/해금 | `get_stage()` | 클리어 판정 시, 스테이지 맵 UI |

프레임마다 쿼리하는 시스템은 없다. 모든 접근은 이벤트 트리거 기반.

---

## JSON Schema Examples

### heroes.json

```json
{
  "meta": { "version": "1.0.0", "last_updated": "2026-03-28", "description": "영웅 정의" },
  "heroes": {
    "musa": {
      "id": "musa",
      "name_ko": "무사",
      "role": "WARRIOR",
      "rarity": "COMMON",
      "description_ko": "강인한 근접 전투원. 높은 단일 대상 피해.",
      "sprite_path": "res://assets/art/heroes/musa.png",
      "atk_type": "physical",
      "base_stats": {
        "atk": 40,
        "atk_speed": 1.2,
        "range": 80,
        "skill_cooldown": 12.0,
        "crit_rate": 0.10,
        "crit_damage": 1.5,
        "atk_area": 0
      },
      "skills": ["musa_blade_storm"],
      "unlock_condition": { "type": "STAGE_CLEAR", "stage_id": "stage_1" },
      "collection_index": 1
    },
    "gungsu": {
      "id": "gungsu",
      "name_ko": "궁수",
      "role": "ARCHER",
      "rarity": "COMMON",
      "description_ko": "원거리 정밀 사격. 높은 사거리, 중간 피해.",
      "sprite_path": "res://assets/art/heroes/gungsu.png",
      "atk_type": "physical",
      "base_stats": { "atk": 30, "atk_speed": 1.5, "range": 200, "skill_cooldown": 8.0, "crit_rate": 0.20, "crit_damage": 2.0, "atk_area": 0 },
      "skills": ["gungsu_rain_of_arrows"],
      "unlock_condition": { "type": "DEFAULT_UNLOCKED" },
      "collection_index": 2
    },
    "dosa": {
      "id": "dosa",
      "name_ko": "도사",
      "role": "MAGE",
      "rarity": "UNCOMMON",
      "description_ko": "광역 도술. 중간 사거리, 범위 피해.",
      "sprite_path": "res://assets/art/heroes/dosa.png",
      "atk_type": "magical",
      "base_stats": { "atk": 35, "atk_speed": 0.8, "range": 150, "skill_cooldown": 10.0, "crit_rate": 0.05, "crit_damage": 1.8, "atk_area": 40 },
      "skills": ["dosa_thunder_talisman"],
      "unlock_condition": { "type": "STAGE_CLEAR", "stage_id": "stage_2" },
      "collection_index": 3
    },
    "munyeo": {
      "id": "munyeo",
      "name_ko": "무녀",
      "role": "SUPPORT",
      "rarity": "UNCOMMON",
      "description_ko": "지원/디버프. 인접 영웅 버프, 적 약화.",
      "sprite_path": "res://assets/art/heroes/munyeo.png",
      "atk_type": "magical",
      "base_stats": { "atk": 18, "atk_speed": 1.0, "range": 120, "skill_cooldown": 15.0, "crit_rate": 0.08, "crit_damage": 1.5, "atk_area": 0 },
      "skills": ["munyeo_spirit_blessing"],
      "unlock_condition": { "type": "STAGE_THREE_STAR", "stage_id": "stage_2" },
      "collection_index": 4
    }
  }
}
```

**필드 규약**:
- `atk_type`: `"physical"` / `"magical"` — 피해 유형, Combat 시스템이 방어 스탯 선택에 사용
- `role`: `WARRIOR` / `ARCHER` / `MAGE` / `SUPPORT`
- `rarity`: `COMMON` / `UNCOMMON` / `RARE` / `LEGENDARY`
- `atk_speed`: 초당 공격 횟수
- `range`: 픽셀 단위 반경
- `crit_rate`: 크리티컬 확률 (0.0~1.0)
- `crit_damage`: 크리티컬 데미지 배율 (1.0 이상)
- `atk_area`: 광역 공격 반경 (0 = 단일 타겟, >0 = 해당 반경 내 전체)
- `unlock_condition.type`: `DEFAULT_UNLOCKED` / `STAGE_CLEAR` / `STAGE_THREE_STAR`

### enemies.json

```json
{
  "meta": { "version": "1.0.0", "last_updated": "2026-03-28", "description": "적 유닛 정의" },
  "enemies": {
    "fire_oni": {
      "id": "fire_oni", "name_ko": "화염 도깨비", "type": "NORMAL",
      "sprite_path": "res://assets/art/enemies/fire_oni.png",
      "stats": { "hp": 80, "move_speed": 60, "armor": 0, "magic_resist": 0, "reward_gold": 10 },
      "abilities": [], "path_behavior": "STRAIGHT", "size": "SMALL"
    },
    "phantom_archer": {
      "id": "phantom_archer", "name_ko": "망령 궁수", "type": "NORMAL",
      "sprite_path": "res://assets/art/enemies/phantom_archer.png",
      "stats": { "hp": 50, "move_speed": 100, "armor": 0, "magic_resist": 0, "reward_gold": 12 },
      "abilities": ["FAST"], "path_behavior": "STRAIGHT", "size": "SMALL"
    },
    "stone_troll": {
      "id": "stone_troll", "name_ko": "돌 트롤", "type": "NORMAL",
      "sprite_path": "res://assets/art/enemies/stone_troll.png",
      "stats": { "hp": 300, "move_speed": 30, "armor": 5, "magic_resist": 0, "reward_gold": 25 },
      "abilities": ["ARMORED"], "path_behavior": "STRAIGHT", "size": "LARGE"
    },
    "dark_shaman_boss": {
      "id": "dark_shaman_boss", "name_ko": "암흑 무당", "type": "BOSS",
      "sprite_path": "res://assets/art/enemies/dark_shaman_boss.png",
      "stats": { "hp": 2000, "move_speed": 40, "armor": 10, "magic_resist": 5, "reward_gold": 200 },
      "abilities": ["BOSS_REGEN", "SUMMON_MINIONS"],
      "ability_params": {
        "BOSS_REGEN": { "hp_per_second": 10, "trigger_hp_ratio": 0.5 },
        "SUMMON_MINIONS": { "minion_id": "fire_oni", "count": 3, "interval_seconds": 20.0 }
      },
      "path_behavior": "STRAIGHT", "size": "BOSS",
      "boss_phase_thresholds": [0.75, 0.5, 0.25],
      "drop_items": ["talisman_of_enhancement"]
    }
  }
}
```

**필드 규약**:
- `type`: `NORMAL` / `ELITE` / `BOSS`
- `abilities`: `FAST` / `ARMORED` / `FLYING` / `STEALTH` / `BOSS_REGEN` / `SUMMON_MINIONS`
- `ability_params`: abilities에 파라미터가 필요한 경우만 존재 (선택적)
- `armor`: 고정 피해 감소량

### enhancement.json

enhancement-system.md의 모든 수치를 직접 반영.

```json
{
  "meta": { "version": "1.0.0", "last_updated": "2026-03-28", "description": "강화 시스템 수치" },
  "config": {
    "max_level": 10,
    "floor_level": 4,
    "fragment_per_fail": 1,
    "fragments_per_talisman": 10
  },
  "levels": [
    { "level": 0, "zone": "SAFE", "success_rate": 1.0, "fail_drop": 0, "gold_cost": 50, "stone_grade": "LOW", "stone_count": 1, "atk_multiplier": 1.00, "range_multiplier": 1.00, "cooldown_reduction": 0.00, "pity": null },
    { "level": 1, "zone": "SAFE", "success_rate": 1.0, "fail_drop": 0, "gold_cost": 100, "stone_grade": "LOW", "stone_count": 1, "atk_multiplier": 1.05, "range_multiplier": 1.00, "cooldown_reduction": 0.00, "pity": null },
    { "level": 2, "zone": "SAFE", "success_rate": 0.9, "fail_drop": 0, "gold_cost": 200, "stone_grade": "LOW", "stone_count": 2, "atk_multiplier": 1.10, "range_multiplier": 1.00, "cooldown_reduction": 0.00, "pity": null },
    { "level": 3, "zone": "SAFE", "success_rate": 0.8, "fail_drop": 0, "gold_cost": 400, "stone_grade": "LOW", "stone_count": 3, "atk_multiplier": 1.16, "range_multiplier": 1.03, "cooldown_reduction": 0.00, "pity": null },
    { "level": 4, "zone": "SAFE", "success_rate": 0.7, "fail_drop": 0, "gold_cost": 700, "stone_grade": "LOW", "stone_count": 5, "atk_multiplier": 1.22, "range_multiplier": 1.05, "cooldown_reduction": 0.00, "pity": null },
    { "level": 5, "zone": "DANGER", "success_rate": 0.55, "fail_drop": 1, "gold_cost": 1200, "stone_grade": "MID", "stone_count": 2, "atk_multiplier": 1.30, "range_multiplier": 1.08, "cooldown_reduction": 0.05, "pity": null },
    { "level": 6, "zone": "DANGER", "success_rate": 0.40, "fail_drop": 1, "gold_cost": 2000, "stone_grade": "MID", "stone_count": 3, "atk_multiplier": 1.40, "range_multiplier": 1.10, "cooldown_reduction": 0.08, "pity": { "threshold": 5, "bonus_rate": 0.20 } },
    { "level": 7, "zone": "HELL", "success_rate": 0.25, "fail_drop": 2, "gold_cost": 3500, "stone_grade": "MID", "stone_count": 5, "atk_multiplier": 1.55, "range_multiplier": 1.13, "cooldown_reduction": 0.12, "pity": null },
    { "level": 8, "zone": "HELL", "success_rate": 0.15, "fail_drop": 2, "gold_cost": 6000, "stone_grade": "HIGH", "stone_count": 2, "atk_multiplier": 1.75, "range_multiplier": 1.16, "cooldown_reduction": 0.16, "pity": null },
    { "level": 9, "zone": "HELL", "success_rate": 0.08, "fail_drop": 2, "gold_cost": 10000, "stone_grade": "HIGH", "stone_count": 3, "atk_multiplier": 2.00, "range_multiplier": 1.20, "cooldown_reduction": 0.20, "pity": { "threshold": 10, "bonus_rate": 1.0 } },
    { "level": 10, "zone": "MAX", "success_rate": 0.0, "fail_drop": 0, "gold_cost": 0, "stone_grade": "NONE", "stone_count": 0, "atk_multiplier": 2.40, "range_multiplier": 1.25, "cooldown_reduction": 0.25, "pity": null }
  ]
}
```

**인덱싱 규약**: `levels[current_level]`은 **현재 단계에서 다음 단계로 시도할 때의 데이터**를 담는다.
- +0→+1 시도: `levels[0]` 사용 (success_rate=1.0, gold_cost=50)
- +6→+7 시도: `levels[6]` 사용 (success_rate=0.40, pity.threshold=5)
- `levels[10]`은 +10 최종 상태 (강화 불가, success_rate=0.0)
- 배열 길이 반드시 11

### waves.json

```json
{
  "meta": { "version": "1.0.0", "last_updated": "2026-03-28", "description": "웨이브 구성" },
  "stage_waves": {
    "stage_1": {
      "total_waves": 5,
      "waves": [
        {
          "wave_index": 0, "delay_before_seconds": 5.0, "spawn_interval_seconds": 1.5,
          "groups": [
            { "enemy_id": "fire_oni", "count": 5, "spawn_delay_seconds": 0.0 }
          ]
        },
        {
          "wave_index": 1, "delay_before_seconds": 8.0, "spawn_interval_seconds": 1.2,
          "groups": [
            { "enemy_id": "fire_oni", "count": 6, "spawn_delay_seconds": 0.0 },
            { "enemy_id": "phantom_archer", "count": 2, "spawn_delay_seconds": 5.0 }
          ]
        },
        {
          "wave_index": 4, "delay_before_seconds": 15.0, "spawn_interval_seconds": 0.8,
          "is_boss_wave": true,
          "groups": [
            { "enemy_id": "fire_oni", "count": 5, "spawn_delay_seconds": 0.0 },
            { "enemy_id": "dark_shaman_boss", "count": 1, "spawn_delay_seconds": 10.0 }
          ]
        }
      ]
    }
  }
}
```

### stages.json

```json
{
  "meta": { "version": "1.0.0", "last_updated": "2026-03-28", "description": "스테이지 메타데이터" },
  "stages": {
    "stage_1": {
      "id": "stage_1", "name_ko": "마을 입구", "chapter": 1, "order_in_chapter": 1,
      "scene_path": "res://src/gameplay/stages/stage_1.tscn",
      "unlock_condition": { "type": "DEFAULT_UNLOCKED" },
      "star_conditions": {
        "star_1": { "type": "STAGE_CLEAR" },
        "star_2": { "type": "NO_LEAK", "description_ko": "적 누출 없이 클리어" },
        "star_3": { "type": "UNDER_TIME_SECONDS", "value": 180, "description_ko": "3분 이내 클리어" }
      },
      "rewards": {
        "first_clear": { "gold": 200, "hero_id": "musa" },
        "star_2": { "item_id": "talisman_of_enhancement", "count": 1 },
        "star_3": { "item_id": "stone_low", "count": 5 }
      },
      "slot_count": 3,
      "slot_roles": {
        "slot_0": ["WARRIOR", "MAGE", "SUPPORT", "ARCHER"],
        "slot_1": ["ARCHER"],
        "slot_2": ["WARRIOR", "MAGE", "SUPPORT", "ARCHER"]
      }
    }
  }
}
```

**설계 결정**: 슬롯 좌표는 씬 파일(`.tscn`)에서 관리. JSON에는 `slot_roles`(역할 제한)만 보관.

### economy.json

```json
{
  "meta": { "version": "1.0.0", "last_updated": "2026-03-28", "description": "경제 파라미터" },
  "gold": {
    "starting_gold": 200,
    "income_per_wave_cleared": 50
  },
  "enhancement_stones": {
    "grades": {
      "LOW":  { "id": "stone_low",  "name_ko": "하급 강화석", "drop_weight": 70 },
      "MID":  { "id": "stone_mid",  "name_ko": "중급 강화석", "drop_weight": 25 },
      "HIGH": { "id": "stone_high", "name_ko": "상급 강화석", "drop_weight": 5 }
    },
    "enemy_kill_drop_chance": 0.05,
    "boss_guaranteed_count": 3,
    "boss_grade_weights": { "LOW": 30, "MID": 50, "HIGH": 20 }
  },
  "fragments": {
    "per_enhancement_fail": 1,
    "exchange_rate": { "fragments_needed": 10, "gives_item_id": "talisman_of_enhancement" }
  },
  "hero_duplicate": {
    "convert_to_stone_grade": "LOW",
    "convert_count": 2
  }
}
```

### items.json

```json
{
  "meta": { "version": "1.0.0", "last_updated": "2026-03-28", "description": "아이템 정의" },
  "items": {
    "talisman_of_enhancement": {
      "id": "talisman_of_enhancement", "name_ko": "강화 부적", "category": "PROTECTION",
      "description_ko": "강화 실패 시 단계 하락 방지. 성공 시 소모 안 됨.",
      "icon_path": "res://assets/art/items/talisman.png",
      "max_stack": 99,
      "effect": { "type": "PREVENT_DROP", "applicable_zones": ["DANGER"], "consumed_on_fail": true, "consumed_on_success": false }
    },
    "celestial_blessing": {
      "id": "celestial_blessing", "name_ko": "천상의 축복", "category": "PROTECTION",
      "description_ko": "강화 실패 시 -1만 하락 (기본 -2 대신).",
      "icon_path": "res://assets/art/items/celestial_blessing.png",
      "max_stack": 99,
      "effect": { "type": "REDUCE_DROP", "drop_override": 1, "applicable_zones": ["HELL"], "consumed_on_fail": true, "consumed_on_success": false }
    },
    "holy_scroll": {
      "id": "holy_scroll", "name_ko": "강화 성공 주문서", "category": "BOOST",
      "description_ko": "다음 강화 시도 성공률 +15%.",
      "icon_path": "res://assets/art/items/holy_scroll.png",
      "max_stack": 99,
      "effect": { "type": "RATE_BOOST", "bonus_rate": 0.15, "applicable_zones": ["SAFE", "DANGER", "HELL"], "consumed_on_fail": true, "consumed_on_success": true }
    },
    "stone_low": {
      "id": "stone_low", "name_ko": "하급 강화석", "category": "MATERIAL",
      "icon_path": "res://assets/art/items/stone_low.png",
      "max_stack": 999,
      "effect": { "type": "ENHANCEMENT_MATERIAL", "grade": "LOW" }
    },
    "stone_mid": {
      "id": "stone_mid", "name_ko": "중급 강화석", "category": "MATERIAL",
      "icon_path": "res://assets/art/items/stone_mid.png",
      "max_stack": 999,
      "effect": { "type": "ENHANCEMENT_MATERIAL", "grade": "MID" }
    },
    "stone_high": {
      "id": "stone_high", "name_ko": "상급 강화석", "category": "MATERIAL",
      "icon_path": "res://assets/art/items/stone_high.png",
      "max_stack": 999,
      "effect": { "type": "ENHANCEMENT_MATERIAL", "grade": "HIGH" }
    },
    "soul_fragment": {
      "id": "soul_fragment", "name_ko": "영혼의 파편", "category": "CURRENCY",
      "icon_path": "res://assets/art/items/soul_fragment.png",
      "max_stack": 9999,
      "effect": { "type": "FRAGMENT_CURRENCY" }
    }
  }
}
```

### skills.json

```json
{
  "meta": { "version": "1.0.0", "last_updated": "2026-03-28", "description": "영웅 스킬" },
  "skills": {
    "musa_blade_storm": {
      "id": "musa_blade_storm", "name_ko": "검풍", "owner_hero_id": "musa",
      "description_ko": "전방 부채꼴로 검기를 날려 범위 내 적에게 피해.",
      "icon_path": "res://assets/art/skills/musa_blade_storm.png",
      "cooldown_seconds": 12.0,
      "damage_type": "PHYSICAL", "damage_multiplier": 2.5,
      "area": { "shape": "CONE", "angle_degrees": 90, "range_pixels": 120 },
      "target": "ALL_ENEMIES_IN_AREA",
      "status_effect": null,
      "vfx_id": "vfx_blade_storm", "sfx_id": "sfx_sword_slash"
    },
    "gungsu_rain_of_arrows": {
      "id": "gungsu_rain_of_arrows", "name_ko": "화살 비", "owner_hero_id": "gungsu",
      "description_ko": "지정 영역에 화살을 쏟아내 적에게 피해 + 감속.",
      "icon_path": "res://assets/art/skills/gungsu_rain_of_arrows.png",
      "cooldown_seconds": 8.0,
      "damage_type": "PHYSICAL", "damage_multiplier": 1.5,
      "area": { "shape": "CIRCLE", "range_pixels": 150 },
      "target": "ALL_ENEMIES_IN_AREA",
      "status_effect": { "type": "SLOW", "amount": 0.3, "duration_seconds": 2.0 },
      "vfx_id": "vfx_rain_of_arrows", "sfx_id": "sfx_arrow_volley"
    },
    "dosa_thunder_talisman": {
      "id": "dosa_thunder_talisman", "name_ko": "뇌전 부적", "owner_hero_id": "dosa",
      "description_ko": "뇌전 도술로 범위 피해 + 마비.",
      "icon_path": "res://assets/art/skills/dosa_thunder_talisman.png",
      "cooldown_seconds": 10.0,
      "damage_type": "MAGIC", "damage_multiplier": 3.0,
      "area": { "shape": "CIRCLE", "range_pixels": 180 },
      "target": "ALL_ENEMIES_IN_AREA",
      "status_effect": { "type": "STUN", "duration_seconds": 1.5 },
      "vfx_id": "vfx_thunder_talisman", "sfx_id": "sfx_thunder_crack"
    },
    "munyeo_spirit_blessing": {
      "id": "munyeo_spirit_blessing", "name_ko": "영혼 강복", "owner_hero_id": "munyeo",
      "description_ko": "인접 영웅 2기의 공격력 30% 증폭.",
      "icon_path": "res://assets/art/skills/munyeo_spirit_blessing.png",
      "cooldown_seconds": 15.0,
      "damage_type": "NONE", "damage_multiplier": 0.0,
      "area": { "shape": "CIRCLE", "range_pixels": 200 },
      "target": "ALLIED_HEROES_IN_AREA", "max_targets": 2,
      "status_effect": { "type": "ATK_BUFF", "amount": 0.30, "duration_seconds": 5.0 },
      "vfx_id": "vfx_spirit_blessing", "sfx_id": "sfx_spiritual_chant"
    }
  }
}
```

**설계 결정**: `damage_formula` 문자열 대신 `damage_multiplier` float 사용.
스킬 데미지 = `hero.base_stats.atk × enhancement.atk_multiplier × skill.damage_multiplier`

---

## Formulas

이 시스템 자체는 공식이 없다 (데이터를 저장/서비스하는 인프라).
각 시스템이 데이터를 소비하여 계산하는 공식은 해당 시스템 GDD에 정의.

**참조 공식 (이 데이터를 소비하는 핵심 공식)**:

```
스킬_데미지 = base_stats.atk × enhancement.atk_multiplier[level] × skill.damage_multiplier
실질_사거리 = base_stats.range × enhancement.range_multiplier[level]
실질_쿨다운 = base_stats.skill_cooldown × (1.0 - enhancement.cooldown_reduction[level])
실질_피해 = max(1, 스킬_데미지 - enemy.stats.armor)
```

---

## Edge Cases

| 상황 | 처리 |
|------|------|
| JSON 파일 누락 | `data_load_failed` 시그널 + 에러 화면. 게임 진행 차단 |
| JSON 파싱 오류 | 줄 번호 포함 에러 로그 + 게임 진행 차단 |
| 크로스레퍼런스 ID 불일치 | "heroes.json: musa의 skill ID 'xxx'가 skills.json에 없음" 로그 + 게임 진행 차단 |
| `enhancement.levels` 길이 ≠ 11 | 실행 차단 |
| `success_rate` 범위 이탈 (< 0.0 or > 1.0) | 실행 차단 |
| `enemy.stats.hp` ≤ 0 | 경고 로그 (실행 허용, 즉시 사망) |
| 런타임에 존재하지 않는 ID 쿼리 | 빈 Dictionary `{}` 반환 + `push_warning()` |
| 웹 빌드에서 `DataManager.reload()` 호출 | 무동작 (에러 없이 무시) |
| `meta.version` 불일치 | 경고 로그만 출력 (실행 허용) |

---

## Dependencies

| System | Direction | Nature |
|--------|-----------|--------|
| 없음 | — | Foundation 레이어 — 이 시스템은 다른 시스템에 의존하지 않음 |
| 전투/데미지 | 이 시스템에 의존 | 영웅/적 스탯, 강화 배율 |
| 적 경로/AI | 이 시스템에 의존 | 적 스탯, 행동 패턴 |
| 타워 배치 | 이 시스템에 의존 | 영웅 역할, 슬롯 정보 |
| 경제 | 이 시스템에 의존 | 골드/강화석 파라미터 |
| 웨이브 방어 | 이 시스템에 의존 | 웨이브 구성 |
| 스킬 발동 | 이 시스템에 의존 | 스킬 데이터 |
| 영웅 강화 | 이 시스템에 의존 | 강화 확률/비용/배율 |
| 영웅 수집 | 이 시스템에 의존 | 영웅 도감 데이터 |
| Item/Inventory | 이 시스템에 의존 | 아이템 정의 |
| 스테이지 진행 | 이 시스템에 의존 | 별점/보상/해금 조건 |

---

## Tuning Knobs

이 시스템 자체의 튜닝 파라미터는 최소한이다 (데이터 서비스 인프라).

| Parameter | Current Value | Safe Range | Effect |
|-----------|--------------|------------|--------|
| `STRICT_VALIDATION` | `true` | bool | `false`면 크로스레퍼런스 오류를 경고로 강등 (개발 중 임시 데이터 허용) |
| `LOG_LEVEL` | `"INFO"` | INFO/DEBUG | DEBUG 시 모든 getter 호출 로그 (성능 영향, 개발 전용) |

게임플레이 밸런스 튜닝 값은 각 JSON 파일에 직접 정의되며, 해당 시스템 GDD의 Tuning Knobs 섹션에서 관리.

---

## Acceptance Criteria

### 로딩
- [ ] 게임 시작 시 8개 JSON이 모두 로드된다
- [ ] 전체 로드가 100ms 이내에 완료된다 (웹 빌드 기준)
- [ ] 로드 성공 시 `data_loaded_successfully` 시그널이 발행된다
- [ ] 로드 실패 시 에러 화면에 파일명과 원인이 표시된다

### 스키마 검증
- [ ] `enhancement.levels` 배열 길이 ≠ 11일 때 실행이 차단된다
- [ ] `success_rate` 범위 이탈 시 실행이 차단된다
- [ ] 크로스레퍼런스 ID 불일치 시 실행이 차단된다

### API 정확성
- [ ] `get_hero("musa")`가 musa 전체 데이터를 반환한다
- [ ] `get_hero("nonexistent")`가 빈 `{}` 반환 + 경고 출력
- [ ] `get_enhancement_level(6)`이 `success_rate: 0.40`을 포함한다
- [ ] `get_waves("stage_1")`이 5개 웨이브 배열을 반환한다
- [ ] `get_all_heroes()`가 4개 영웅 배열을 반환한다

### 강화 시스템 연동
- [ ] 강화 확률이 `get_enhancement_level(n).success_rate`와 일치한다
- [ ] 강화 비용이 `get_enhancement_level(n).gold_cost`와 일치한다
- [ ] Pity 데이터가 `get_enhancement_level(n).pity`에서 정확히 읽힌다

### 웹 빌드
- [ ] 웹 내보내기에서 모든 JSON이 `.pck`에 포함된다
- [ ] 웹에서 `reload()` 호출 시 에러 없이 무시된다
- [ ] `FileAccess.open()` null 체크가 모든 로드 경로에 존재한다
