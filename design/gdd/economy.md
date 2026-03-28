# Economy System (경제 시스템)

> **Status**: Designed
> **Author**: economy-designer + user
> **Last Updated**: 2026-03-28
> **Implements Pillar**: 강화 도박의 긴장감 / 파밍 동기 유지

---

## 1. Overview

풍운지기의 경제 시스템은 장기 영속 통화인 **골드(Gold)**, **강화석(Enhancement Stone)**,
**영웅 조각(Hero Shard)** 와, 전투 세션 로컬 통화인 **보물(Treasure)** 의 흐름을 관리한다.

경제의 중심축은 강화 시스템과 보물 공방이다. 웨이브 방어로 자원을 벌고, 강화 시도와
유물 확률 강화로 자원을 소모하는 파밍-소비 루프가 게임의 장기 참여 동기를 만든다.
모든 자원은 게임플레이로만 획득 가능하며 실제 결제 수단은 존재하지 않는다.

EconomyManager 오토로드 싱글턴이 모든 잔고를 보유하고, 원자적(atomic) 트랜잭션을 통해
자원이 음수로 가거나 정합성이 깨지는 상황을 방지한다.

---

## 2. Player Fantasy

> "웨이브를 버텨낼 때마다 골드와 강화석이 쌓인다.
> 지금 당장 +7 도전에 쓸까, 아니면 부적 하나를 더 모아서 안전하게 할까?
> 기왕 이렇게 된 거 그냥 질러보자 — 성공이다! 자원이 아깝지 않다."

플레이어는 **수집가이자 투기꾼**이다. 파밍이 지루하지 않으려면 소비처가 명확해야 하고,
소비가 허탈하지 않으려면 파밍이 빠르게 이루어져야 한다. 경제 시스템은 이 두 감각의
균형점을 숫자로 정의한다.

핵심 감정 설계:
- **파밍 만족감**: 웨이브 클리어 후 골드/강화석이 눈에 보이게 쌓임
- **소비 긴장감**: "부적 살 돈을 아껴서 날 강화 할까" 선택의 딜레마
- **보상 기대감**: 강화 성공 시 투자 대비 극적인 스탯 향상

---

## 3. Detailed Design

### 3.1 Currency Types (통화 종류)

장기 영속 통화는 3종으로 유지한다. 여기에 프로토타입 전투 루프용 로컬 통화 `보물`을 추가한다.
보물은 세션 종료 후 저장되지 않는 전투 내 강화용 자원으로 취급한다.

| 통화 | 한국어 명칭 | 아이콘 색 | 주요 용도 | 획득처 |
|------|------------|----------|----------|--------|
| Gold | 골드 | 황금색 | 강화 비용, 보호 아이템 구매 | 웨이브 클리어, 스테이지 보상 |
| Enhancement Stone | 강화석 | 청록색 | 강화 시도 재료 | 웨이브 드롭, 스테이지 보상, 보스 드롭 |
| Hero Shard | 영웅 조각 | 보라색 | 영웅 해금 | 웨이브 드롭, 챕터 완료 |
| Treasure | 보물 | 자홍/금색 | 보물 공방 유물 확률 강화 | 웨이브 보상, 엘리트 드랍, 보스 처치 |

**영혼의 파편 (Soul Fragment)** 은 별도 통화가 아니라 강화석의 파생 단위이다.
파편 10개 = 강화석 1개 (내부적으로 `soul_fragments` 필드로 저장, UI에서 "조각 X/10" 표시).
이 방식은 통화 종류를 3개로 유지하면서 실패 보상의 누적 피드백을 제공한다.

> **설계 메모**: 보물은 장기 경제 인플레이션을 일으키지 않도록 `세션 로컬`로 운용한다.
> 즉, 메타 경제를 무겁게 늘리지 않으면서도 전투와 정비 구간 사이의 리스크/리워드를 강화한다.

#### 통화 상한선 (Overflow Prevention)

| 통화 | 최대 보유량 | 초과 처리 |
|------|-----------|----------|
| Gold | 9,999,999 | 초과분 획득 차단 + 경고 메시지 |
| Enhancement Stone | 9,999 | 초과분 획득 차단 + 경고 메시지 |
| Hero Shard | 각 영웅별 999 | 초과분 획득 차단 |
| Soul Fragment | 99 | 99 도달 시 자동으로 강화석 9개로 변환 (나머지 유지) |

---

### 3.2 Faucets — Resource Sources (파우셋)

파우셋은 자원이 경제에 유입되는 모든 경로다.

#### 웨이브 클리어 골드 (Wave Clear Gold)

웨이브를 완주할 때마다 지급된다. 각 스테이지의 웨이브 수와 스테이지 번호에 따라 스케일.

```
wave_gold = base_wave_gold × stage_gold_multiplier[stage] × wave_index_bonus[wave]
```

| 파라미터 | 설명 |
|---------|------|
| `base_wave_gold` | economy.json에서 읽음, 기본값 120 |
| `stage_gold_multiplier[stage]` | 스테이지별 배율 (스테이지 1=1.0, 스테이지 5=2.0) |
| `wave_index_bonus[wave]` | 웨이브 순서 보너스 (1~0.5웨이브=1.0, 후반웨이브=1.3) |

#### 스테이지 클리어 보너스 (Stage Clear Bonus)

스테이지 완료 시 1회 지급. 별점(1~3성)에 따라 추가 보너스.

```
stage_bonus_gold = base_stage_clear_gold × stage_multiplier[stage]
stage_bonus_stones = base_stage_clear_stones × stage_multiplier[stage]
```

| 별점 | 골드 배율 | 강화석 배율 |
|-----|---------|-----------|
| 1성 | 1.0× | 1.0× |
| 2성 | 1.3× | 1.3× |
| 3성 | 1.6× | 1.6× + 1 추가 |

#### 보스 킬 보너스 (Boss Kill Bonus)

각 챕터 마지막 스테이지의 보스 처치 시 1회 지급.

```
boss_gold = base_boss_gold × chapter_index
boss_stones = base_boss_stones + floor(chapter_index / 2)
```

#### 영웅 중복 획득 (Hero Duplicate Conversion)

이미 보유한 영웅 재획득 시 영웅 조각으로 자동 변환. 자원 낭비 방지 및 적립 보상 역할.

```
duplicate_shards = hero_shard_per_duplicate  # economy.json, 기본값 5
```

#### 업적 보상 (Achievement Reward)

최초 달성 시 1회 지급. 반복 획득 없음 (인플레이션 방지).

| 업적 예시 | 보상 |
|---------|------|
| 첫 번째 웨이브 클리어 | 골드 500 |
| 첫 번째 강화 시도 | 강화석 3 |
| +5 달성 | 강화 부적 1 |
| 스테이지 1 3성 완료 | 강화석 5, 골드 1000 |
| 영웅 3종 보유 | 영웅 조각 × 10 |

---

#### 보물 획득 (Treasure Faucet) — 전투 세션 로컬

보물은 장기 잔고가 아니라 한 판 안에서만 사용하는 전투 로컬 자원이다.

- 웨이브 완료 시 1개 기본 지급
- 후반 웨이브(5+)는 추가 지급 가능
- 엘리트 적 처치 시 확률 지급
- 보스 처치 시 고정 지급

보물은 `TreasureForgeSystem`이 소유하며, 정비 구간 UI에서만 소비 가능하다.

---

### 3.3 Sinks — Resource Drains (싱크)

싱크는 자원이 경제에서 빠져나가는 모든 경로다. 강화 시스템이 주 싱크이므로
다른 싱크는 보조 역할로 설계한다.

#### 강화 시도 비용 (Enhancement Attempt Cost) — 주 싱크

economy.json의 `enhancement_costs` 테이블에서 로드. 아래는 **정규 비용표**다.

> **주의**: enhancement-system.md 섹션 4.1의 비용표와 수치가 다르다.
> economy.md의 아래 표를 정규 소스(source of truth)로 사용하고,
> enhancement-system.md는 다음 GDD 개정 시 이 표로 통일한다.

| 강화 단계 | 골드 비용 | 강화석 비용 | 구간 |
|---------|---------|-----------|------|
| +0 → +1 | 100 | 1 | SAFE |
| +1 → +2 | 200 | 1 | SAFE |
| +2 → +3 | 300 | 2 | SAFE |
| +3 → +4 | 500 | 2 | SAFE |
| +4 → +5 | 800 | 3 | DANGER |
| +5 → +6 | 1,200 | 4 | DANGER |
| +6 → +7 | 2,000 | 5 | DANGER |
| +7 → +8 | 3,000 | 7 | HELL |
| +8 → +9 | 4,000 | 8 | HELL |
| +9 → +10 | 5,000 | 10 | HELL |

#### 보호 아이템 구매 (Protection Item Purchase) — 보조 싱크

items.json에서 로드. 가격은 "가성비 고민"이 발생하는 구간에 설정한다.
너무 비싸면 아무도 사지 않고, 너무 싸면 항상 구매해 긴장감이 사라진다.

| 아이템 | 한국어 명칭 | 골드 가격 | 대상 구간 | 설계 근거 |
|-------|-----------|---------|---------|---------|
| Enhancement Talisman | 강화 부적 | 1,500 | DANGER (+5~+7) | +5→+6 시도(1,200골드)보다 약간 비쌈. 부적 가치 = 실패 시 하락 비용(~2,000골드)의 75% |
| Celestial Blessing | 천상의 축복 | 4,000 | HELL (+8~+10) | +8→+9 시도(4,000골드)와 동일. HELL 실패 비용(+6 복귀 시 ~9,000골드)의 44% |
| Success Scroll | 강화 성공 주문서 | 800 | 전 구간 | 가장 저렴. "확률 개선" vs "보호" 선택 딜레마 제공 |

**부적 획득처 다원화**: 골드 구매 외에도 3성 클리어, 파편 교환(10개)으로 획득 가능.
완전한 골드 싱크로만 고정하지 않아 플레이어 선택권을 보장한다.

#### 영웅 해금 (Hero Unlock) — 보조 싱크

영웅 조각 시스템으로 해금. 골드는 소모하지 않는다 (영웅 조각만 소모).

```
hero_unlock_cost = hero_shards_required  # items.json 정의, 등급별 차등
```

| 영웅 등급 | 해금 조각 수 | 획득 경로 |
|---------|-----------|---------|
| 일반 (Common) | 20 조각 | 스테이지 드롭 |
| 희귀 (Rare) | 30 조각 | 챕터 보스, 업적 |
| 영웅 (Hero) | 50 조각 | 하드모드, 도전 스테이지 |

---

#### 보물 공방 강화 (Treasure Forge Upgrade) — 세션 싱크

- 강화 시도 1회당 보물 1개 소비
- 성공 시 유물 레벨 상승
- 실패 시 레벨 하락/파괴 없음
- 실패 누적 시 다음 성공 확률 상승

이 싱크는 장기 경제가 아니라 **웨이브 사이 의사결정 압력**을 만드는 목적이다.

---

### 3.4 EconomyManager Autoload

**파일 위치**: `src/core/economy_manager.gd`
**오토로드 이름**: `EconomyManager`

EconomyManager는 모든 통화 잔고의 유일한 소유자다. 다른 시스템은 직접 잔고를 수정하지 않고
반드시 EconomyManager의 메서드를 통해 거래한다.

#### 저장 데이터 구조

```gdscript
# EconomyManager 내부 상태 (SaveSystem이 직렬화)
var gold: int = 0
var enhancement_stones: int = 0
var soul_fragments: int = 0           # 파편 (내부 단위, 10개 = 강화석 1개)
var hero_shards: Dictionary = {}      # { hero_id: int }
```

#### 공개 API

```gdscript
# 조회
func get_gold() -> int
func get_stones() -> int
func get_hero_shards(hero_id: String) -> int
func can_afford(cost: EconomyCost) -> bool   # gold+stones 동시 체크

# 획득 (earn)
func earn_gold(amount: int) -> void
func earn_stones(amount: int) -> void
func earn_soul_fragments(amount: int) -> void   # 10개 달성 시 자동 변환
func earn_hero_shards(hero_id: String, amount: int) -> void

# 소비 (spend) — 잔고 부족 시 false 반환, 차감 없음
func spend_gold(amount: int) -> bool
func spend_stones(amount: int) -> bool
func spend_hero_shards(hero_id: String, amount: int) -> bool

# 원자적 복합 트랜잭션
func spend_enhancement_cost(level: int) -> bool  # gold + stones 동시 차감
func spend_item_purchase(item_id: String) -> bool # gold 차감

# 시그널
signal gold_changed(new_amount: int)
signal stones_changed(new_amount: int)
signal hero_shards_changed(hero_id: String, new_amount: int)
signal transaction_failed(reason: String)  # UI가 안내 메시지 표시에 사용
```

#### 싱글턴 역할 근거

EconomyManager가 오토로드인 이유:
- 잔고는 씬 전환 후에도 유지되어야 한다 (스테이지 → 메인 메뉴 → 강화 UI)
- 모든 시스템(WeakDefense, EnhancementSystem, ShopUI)이 동일 잔고를 참조한다
- 시그널 구독으로 UI가 실시간 갱신된다

---

### 3.5 Transaction System

#### 원자성 (Atomicity) 보장

강화 시도는 골드와 강화석을 **동시에** 차감해야 한다. 골드만 차감하고 강화석 부족으로
실패하면 데이터 불일치가 발생한다.

```gdscript
func spend_enhancement_cost(level: int) -> bool:
    var cost = DataManager.get_enhancement_cost(level)
    # 사전 검증 — 둘 다 충분해야만 진행
    if gold < cost.gold_cost or enhancement_stones < cost.stone_cost:
        transaction_failed.emit("재화가 부족합니다")
        return false
    # 원자적 차감
    gold -= cost.gold_cost
    enhancement_stones -= cost.stone_cost
    gold_changed.emit(gold)
    stones_changed.emit(enhancement_stones)
    return true
```

#### 잔고 검증 규칙

- 잔고는 절대 음수가 될 수 없다 (`assert(gold >= 0)`)
- spend 함수는 차감 전 반드시 `can_afford()`를 내부 호출한다
- earn 함수는 상한선 초과 시 초과분을 버리고 `transaction_failed` 시그널 발행

#### 저장 타이밍

- `earn_*` 또는 `spend_*` 호출 직후 `SaveSystem.save_economy()` 호출
- 강화 연출 중 앱 종료 시에도 결과가 저장된 상태여야 한다
  (결과 확정 → 저장 → 연출 재생 순서)

---

### 3.6 Gold Reward Scaling

#### 설계 목표: 세션당 3-5회 강화 시도 지원

위험 구간(DANGER) 강화 1회 평균 비용: 약 1,500골드 (1,200~2,000 평균)
세션당 4회 시도 목표: **6,000골드/세션** 필요

세션 = 스테이지 1회 클리어 (웨이브 약 12개 + 보스 1회)

```
목표 골드/세션 = 웨이브_수 × wave_gold + stage_clear_bonus
6,000 ≈ 12 × 400 + 1,200   (스테이지 1 기준)
```

#### 스테이지별 골드 배율 테이블

| 스테이지 | stage_gold_multiplier | 웨이브당 기대 골드 | 스테이지 보너스 | 세션 총 기대 골드 |
|---------|---------------------|----------------|--------------|----------------|
| Stage 1 | 1.0× | 400 | 1,000 | ~5,800 |
| Stage 2 | 1.2× | 480 | 1,200 | ~6,960 |
| Stage 3 | 1.5× | 600 | 1,500 | ~8,700 |
| Stage 4 | 1.8× | 720 | 1,800 | ~10,440 |
| Stage 5 | 2.0× | 800 | 2,000 | ~11,600 |
| Chapter Boss | — | — | +3,000 | 추가 보상 |

> `base_wave_gold = 400`은 economy.json의 `base_wave_gold` 파라미터.
> 웨이브당 400골드는 위험 구간 평균 시도비용 1,500골드의 약 27%.
> 4~5 웨이브 파밍 = 강화 1회 시도 = 파밍 동기 유지에 충분한 밀도.

#### 웨이브 인덱스 보너스

```
wave_index_bonus[wave] = 1.0 + (wave / total_waves) × 0.3
```
마지막 웨이브는 기본의 1.3배. 끝까지 버틸 이유를 제공한다.

---

### 3.7 Enhancement Stone Acquisition Curve

#### 목표: DANGER 구간 진입 전 강화석 자연 적립

+0→+4 총 강화석 비용: 1+1+2+2 = **6 강화석**
+4→+7 기대 강화석 비용 (실패 포함 기대치): 약 **60 강화석** (섹션 4.2 참조)

플레이어가 +7을 목표로 할 때, 스테이지 4~5 클리어 전후까지 충분한 강화석을 보유해야 한다.

#### 강화석 드롭 구조

```
wave_stone_drop_chance = base_stone_drop_chance × stage_multiplier[stage]
wave_stone_drop_amount = base_stone_drop_amount
```

| 파라미터 | 기본값 | 설명 |
|---------|-------|------|
| `base_stone_drop_chance` | 0.40 | 웨이브당 40% 확률로 강화석 1개 드롭 |
| `base_stone_drop_amount` | 1 | 1회 드롭 시 획득량 |
| 스테이지 클리어 보상 | 2~5 개 | 스테이지 번호 × 1 (소수점 버림) |
| 보스 킬 | 3 + chapter_index | 챕터별 증가 |

**스테이지당 강화석 기대 획득량:**

| 스테이지 | 웨이브 드롭 기대 | 스테이지 보너스 | 합계 기대 |
|---------|--------------|--------------|--------|
| Stage 1 | 12 × 0.40 = 4.8 | 2 | ~6.8 |
| Stage 2 | 12 × 0.45 = 5.4 | 2 | ~7.4 |
| Stage 3 | 12 × 0.50 = 6.0 | 3 | ~9.0 |
| Stage 4 | 12 × 0.55 = 6.6 | 4 | ~10.6 |
| Stage 5 | 12 × 0.60 = 7.2 | 5 | ~12.2 |

**5스테이지 누적**: 약 46 강화석 기대 획득 (실패 보상 파편 제외)
목표 +7 달성 기대 필요량: ~66 강화석 → 5스테이지만으로는 약간 부족.
하드모드 + 업적 + 파편 변환으로 나머지 충당. 적절한 긴장감을 유지한다.

---

### 3.8 Protection Item Pricing

보호 아이템 가격 설계 원칙:
1. **가치 기반 가격**: 아이템의 보호 가치(실패 시 절약되는 기대 비용)의 50~80%
2. **딜레마 제공**: 아이템 구매비 ≈ 시도 비용이어야 "살까 말까" 고민이 생김
3. **접근 가능성**: 1~2회 시도비용으로 구매 가능한 수준

| 아이템 | 골드 가격 | 보호 가치 분석 | 비율 |
|-------|---------|-------------|-----|
| 강화 부적 | 1,500골드 | +5→+6 실패 시 -1하락 → 복구 기대비용 ~2,000골드 | 75% |
| 천상의 축복 | 4,000골드 | +8→+9 실패 시 -2하락 → 복구 기대비용 ~18,000골드 | 22% |
| 강화 성공 주문서 | 800골드 | +15% 확률 향상 → 시도 1회분 절약 기대치 ~1,000골드 | 80% |

> **천상의 축복 가격 근거**: 18,000골드 복구 비용의 22%로 매우 저렴해 보이지만,
> HELL 구간 진입 자체가 매우 드물며 4,000골드는 HELL 구간에서 약 1회 시도 비용에 해당.
> "시도 1회 비용 = 아이템 1개 비용" 등가성이 구매 딜레마를 형성한다.

---

### 3.9 Hero Shard System

MVP 단순 구현. 영웅 조각을 모아 영웅을 해금하는 수집 시스템.

#### 조각 획득

- 웨이브 클리어 후 **5% 확률**로 랜덤 영웅 조각 1~2개 드롭
- 챕터 완료 보상으로 선택한 영웅 조각 10개
- 이미 보유한 영웅 중복 획득 시 해당 영웅 조각 5개로 변환

#### 영웅 해금

영웅 조각이 해금 임계치에 도달하면 자동으로 해금 선택지 표시.
골드 비용 없음 — 조각만 소모.

```gdscript
func try_unlock_hero(hero_id: String) -> bool:
    var required = DataManager.get_hero_unlock_cost(hero_id)
    return spend_hero_shards(hero_id, required)
```

---

### 3.10 Economy Balance Goals

경제 건강 지표 (Economy Health Metrics):

| 지표 | 목표 범위 | 측정 방법 |
|-----|---------|---------|
| 세션당 골드 획득 | 5,000~12,000 | 스테이지 × 보상 합산 |
| 강화 시도 횟수/세션 | 3~5회 | 골드 획득 ÷ 평균 시도 비용 |
| 강화석/세션 획득 | 6~12개 | 웨이브 드롭 기대치 |
| 골드 싱크 비율 | 전체 파우셋의 50~70% | 강화 소비 ÷ 총 획득 |
| 강화석 싱크 비율 | 전체 파우셋의 60~80% | 강화 소비 ÷ 총 획득 |
| 보호 아이템 구매율 | 전체 골드 소비의 15~25% | 아이템 구매 ÷ 총 소비 |

**인플레이션 방지**: 자원 상한선 + 업적 1회 보상 + 실제 결제 없음의 3중 구조로
무한 자원 적립 경로를 차단한다.

---

## 4. Formulas

### 4.1 Wave Gold Formula

```
wave_gold(stage, wave_idx, total_waves) =
    base_wave_gold
    × stage_gold_multiplier[stage]
    × (1.0 + (wave_idx / total_waves) × 0.3)

예시: Stage 3, wave_idx=10, total_waves=12
  = 400 × 1.5 × (1 + 10/12 × 0.3)
  = 400 × 1.5 × 1.25
  = 750 골드
```

### 4.2 Enhancement Stone Expected Cost

+0에서 +7까지 기대 강화석 소비량 계산 (하락 포함).

DANGER 구간 실패 시 -1하락 → 하락 전 단계부터 재시도 필요.
기대 시도 횟수는 기하분포의 기댓값 `E[X] = 1/p`이며, 하락으로 인한 재진입 비용을 포함한다.

| 단계 | 성공률 | 직접 기대 시도 | 강화석/시도 | 기대 강화석 | 하락 재진입 계수 | 보정 기대 강화석 |
|------|-------|-------------|-----------|-----------|--------------|---------------|
| +0→+1 | 100% | 1.0 | 1 | 1.0 | 1.0 | 1.0 |
| +1→+2 | 100% | 1.0 | 1 | 1.0 | 1.0 | 1.0 |
| +2→+3 | 90% | 1.1 | 2 | 2.2 | 1.0 | 2.2 |
| +3→+4 | 80% | 1.25 | 2 | 2.5 | 1.0 | 2.5 |
| +4→+5 | 70% | 1.43 | 3 | 4.3 | 1.0 | 4.3 |
| +5→+6 | 55% | 1.82 | 4 | 7.3 | 1.2 | 8.7 |
| +6→+7 | 40% | 2.50 | 5 | 12.5 | 1.5 | 18.8 |
| **+0~+7 합계** | | | | | | **~38.5 강화석** |

> **하락 재진입 계수**: DANGER 실패 시 재진입 경로 비용을 단순화한 근사치.
> 정밀한 마르코프 체인 계산 대신 실험적 튜닝으로 조정한다.
> +5→+6 계수 1.2 = "평균 1.2회분 하락 재시도 비용 포함"

### 4.3 Protection Item Value Formula

```
item_value = expected_recovery_cost × failure_probability
item_price = item_value × price_ratio

강화 부적 예시:
  +5→+6 실패율 = 0.45
  실패 시 복구 비용 = +4→+6 재강화 기대 골드 = 800/0.7 + 1200/0.55 ≈ 3,325골드
  item_value = 3,325 × 0.45 = 1,496골드
  item_price = 1,496 × 1.0 ≈ 1,500골드 (반올림)
```

### 4.4 Soul Fragment Auto-Conversion

```
auto_convert_threshold = 10     # 파편 10개 = 강화석 1개
fragments_after = soul_fragments % 10
stones_gained = floor(soul_fragments / 10)
```

### 4.5 Session Economy Projection

```
session_gold_earned = (waves × base_wave_gold × stage_mult × avg_wave_bonus) + stage_clear_bonus
session_gold_spent_enhancement = attempts × avg_attempt_cost
session_stone_earned = waves × stone_drop_chance × stone_per_drop + stage_stone_bonus
session_stone_spent = attempts × avg_stone_per_attempt

경제 건강 조건:
  session_gold_spent / session_gold_earned ∈ [0.50, 0.70]
  session_stone_spent / session_stone_earned ∈ [0.60, 0.80]
```

---

## 5. Edge Cases

| 상황 | 처리 방법 |
|-----|---------|
| 강화 시도 중 골드는 충분하나 강화석 부족 | `can_afford()` 사전 검증에서 차단. 강화 버튼 비활성화. "강화석 X개 부족 — 웨이브 클리어로 획득 가능" 안내 메시지 표시 |
| 강화 시도 중 강화석은 충분하나 골드 부족 | 위와 동일 처리. 양쪽 모두 충족해야만 버튼 활성화 |
| 골드 상한 9,999,999 도달 시 추가 획득 | 초과분 버림 + "골드가 가득 찼습니다. 강화에 사용하세요" HUD 메시지. 정상 게임 진행 차단 없음 |
| 강화석 상한 9,999 도달 | 위와 동일. "강화석이 가득 찼습니다" 메시지 |
| 영혼의 파편 99개에서 추가 파편 획득 시도 | 자동 변환 선행 시도 → 변환 후 잔량 계산. 여전히 99 이상이면 초과분 버림 |
| 앱 강제 종료 (강화 연출 중) | 결과 확정 + 잔고 저장 → 연출 재생 순서이므로 재실행 시 올바른 잔고 표시 |
| 동일 프레임에 다수 골드 획득 이벤트 (멀티 보스 동시 사망 등) | `earn_gold()` 는 각 호출마다 독립 처리. 상한 초과 검사는 누적 후 1회 수행하지 않고 각 호출에서 수행 |
| Hero Shard 획득 시 해당 hero_id가 heroes.json에 없는 경우 | 오류 로그 + 조각 획득 무효 처리. 크래시 없이 계속 진행 |
| 세이브 파일 손상 (잔고 불명) | 잔고를 0으로 초기화. 업적 재달성으로 초기 자원 재획득 가능하도록 설계 |
| spend_hero_shards 후 hero_shards[id] == 0 | Dictionary 키 제거하지 않고 0 유지. `get_hero_shards()` 는 키 없으면 0 반환 |

---

## 6. Dependencies

### 이 시스템이 의존하는 시스템

| 시스템 | 의존 내용 |
|-------|---------|
| **DataManager** | economy.json (보상/비용 기준값), enhancement.json (강화 비용표), items.json (아이템 가격) 로드 |
| **SaveSystem** | 골드/강화석/영웅 조각/파편 잔고 영속 저장 및 로드 |

### 이 시스템에 의존하는 시스템

| 시스템 | 의존 내용 |
|-------|---------|
| **EnhancementSystem** | `spend_enhancement_cost(level)` 호출로 골드+강화석 차감, 실패 시 `earn_soul_fragments()` 호출 |
| **WaveDefenseSystem** | 웨이브 클리어 후 `earn_gold()`, `earn_stones()` 호출 |
| **StageManager** | 스테이지 클리어 보너스 `earn_gold()`, `earn_stones()` 호출 |
| **HeroCollection** | `spend_hero_shards()` 로 영웅 해금, `earn_hero_shards()` 로 중복 변환 |
| **ShopUI** | `spend_item_purchase(item_id)` 호출로 보호 아이템 구매 처리 |
| **HUD/UI** | `gold_changed`, `stones_changed` 시그널 구독으로 실시간 잔고 표시 |
| **SaveSystem** | 경제 데이터 직렬화 요청 수신 |

---

## 7. Tuning Knobs

모든 파라미터는 `assets/data/economy.json`에 외부화되어 코드 수정 없이 조정 가능하다.

| 파라미터 | 기본값 | 안전 범위 | 영향 |
|---------|-------|---------|-----|
| `base_wave_gold` | 400 | 200~800 | 세션당 골드 획득량 직접 조정. 높이면 강화 접근성 증가 |
| `stage_gold_multiplier[stage]` | 1.0~2.0 | 0.8~4.0 | 후반 스테이지 보상 가치. 너무 높으면 초반 파밍 의미 감소 |
| `base_stage_clear_gold` | 1,000 | 500~3,000 | 스테이지 완료 보람. 웨이브 총합의 20~30% 권장 |
| `base_stone_drop_chance` | 0.40 | 0.20~0.70 | 강화석 희소성. 낮추면 강화 접근성 감소, 파밍 의존도 증가 |
| `base_stone_drop_amount` | 1 | 1~3 | 드롭당 획득량. `drop_chance`와 역의 관계로 조정 |
| `base_stage_clear_stones` | 2 | 1~5 | 스테이지 완료 강화석 보상 |
| `soul_fragment_per_fail` | 1 | 0~3 | 실패 보상 강도. 0이면 실패가 완전한 손실 |
| `fragments_per_stone` | 10 | 5~20 | 파편 변환 효율. 낮추면 실패 보상 가치 증가 |
| `talisman_gold_price` | 1,500 | 800~3,000 | 부적 접근성. 너무 낮으면 항상 구매 → 긴장감 소멸 |
| `blessing_gold_price` | 4,000 | 2,000~8,000 | 천상의 축복 접근성. HELL 시도 비용과 연동해 조정 |
| `scroll_gold_price` | 800 | 400~1,500 | 주문서 접근성. 가장 저렴한 보호 수단 |
| `hero_shard_drop_chance` | 0.05 | 0.02~0.15 | 영웅 수집 속도. 너무 높으면 수집 의미 감소 |
| `hero_duplicate_shards` | 5 | 1~10 | 중복 보상 가치 |

---

## 8. Acceptance Criteria

### EconomyManager 기능

- [ ] `get_gold()`, `get_stones()`, `get_hero_shards(id)` 가 정확한 현재 잔고를 반환한다
- [ ] `earn_gold(500)` 호출 후 `get_gold()` 가 이전 값 + 500을 반환한다
- [ ] `spend_gold(amount)` 는 잔고가 충분할 때 true를 반환하고 잔고를 차감한다
- [ ] `spend_gold(amount)` 는 잔고가 부족할 때 false를 반환하고 잔고를 변경하지 않는다
- [ ] `earn_gold()` 는 상한(9,999,999) 초과 시 초과분을 버리고 `transaction_failed` 시그널을 발행한다
- [ ] 잔고는 절대 음수가 되지 않는다

### 원자적 트랜잭션

- [ ] `spend_enhancement_cost(level)` 는 골드와 강화석 모두 충분할 때만 양쪽 동시 차감 후 true를 반환한다
- [ ] 골드 충분 + 강화석 부족 시 골드도 차감하지 않고 false를 반환한다
- [ ] 강화석 충분 + 골드 부족 시 강화석도 차감하지 않고 false를 반환한다

### 영혼의 파편 자동 변환

- [ ] `earn_soul_fragments(10)` 호출 시 강화석 1개 자동 획득, 파편 0개가 된다
- [ ] `earn_soul_fragments(15)` 호출 시 강화석 1개 자동 획득, 파편 5개가 된다
- [ ] 파편 누적 99개 도달 시 강화석 9개로 변환, 파편 9개 유지된다

### 보상 스케일링

- [ ] Stage 1 웨이브 12개 × `base_wave_gold=400` × 배율 + 스테이지 보너스 합산이 5,000~7,000골드 범위 내다
- [ ] Stage 5 동일 조건 합산이 11,000~13,000골드 범위 내다
- [ ] 3성 클리어는 1성 대비 골드와 강화석이 각각 60% 이상 더 많다

### 보호 아이템 구매

- [ ] 골드 1,500 이상 보유 시 강화 부적 구매가 가능하고 구매 후 골드가 1,500 차감된다
- [ ] 골드 1,499 보유 시 강화 부적 구매 버튼이 비활성화된다

### 저장/로드

- [ ] 스테이지 완료 후 메인 메뉴로 돌아가도 골드/강화석 잔고가 유지된다
- [ ] 앱 재시작 후 마지막 저장 시점의 잔고가 복원된다

### 경제 밸런스 (통합 테스트)

- [ ] Stage 1~3을 각 1회 클리어 후 +5→+6 강화 시도를 3회 이상 할 수 있는 골드를 보유한다
- [ ] Stage 1~5를 각 1회 클리어 후 강화석 30개 이상을 보유한다 (강화 시도 없이)
- [ ] `base_wave_gold` 를 200으로 낮춰도 Stage 5 클리어 후 DANGER 구간 강화 1회 이상이 가능하다

---

## Appendix A: economy.json 스키마 (초안)

```json
{
  "meta": {
    "version": "1.0.0",
    "last_updated": "2026-03-28",
    "description": "경제 시스템 파라미터"
  },
  "faucets": {
    "base_wave_gold": 400,
    "stage_gold_multiplier": [1.0, 1.2, 1.5, 1.8, 2.0],
    "base_stage_clear_gold": 1000,
    "base_stage_clear_stones": 2,
    "base_boss_gold": 2000,
    "base_boss_stones": 3,
    "base_stone_drop_chance": 0.40,
    "base_stone_drop_amount": 1,
    "hero_shard_drop_chance": 0.05,
    "hero_duplicate_shards": 5,
    "soul_fragment_per_fail": 1
  },
  "conversion": {
    "fragments_per_stone": 10
  },
  "caps": {
    "max_gold": 9999999,
    "max_stones": 9999,
    "max_hero_shards_per_hero": 999,
    "max_soul_fragments": 99
  },
  "enhancement_costs": [
    { "level": 1, "gold_cost": 100, "stone_cost": 1, "zone": "SAFE" },
    { "level": 2, "gold_cost": 200, "stone_cost": 1, "zone": "SAFE" },
    { "level": 3, "gold_cost": 300, "stone_cost": 2, "zone": "SAFE" },
    { "level": 4, "gold_cost": 500, "stone_cost": 2, "zone": "SAFE" },
    { "level": 5, "gold_cost": 800, "stone_cost": 3, "zone": "DANGER" },
    { "level": 6, "gold_cost": 1200, "stone_cost": 4, "zone": "DANGER" },
    { "level": 7, "gold_cost": 2000, "stone_cost": 5, "zone": "DANGER" },
    { "level": 8, "gold_cost": 3000, "stone_cost": 7, "zone": "HELL" },
    { "level": 9, "gold_cost": 4000, "stone_cost": 8, "zone": "HELL" },
    { "level": 10, "gold_cost": 5000, "stone_cost": 10, "zone": "HELL" }
  ]
}
```

## Appendix B: 비용표 불일치 노트

enhancement-system.md 섹션 4.1에 별도의 비용표가 존재하며 수치가 다르다.
이 파일(economy.md)의 `enhancement_costs` 테이블을 **정규 소스(source of truth)**로 사용한다.
enhancement-system.md의 다음 개정 시 이 표로 통일할 것.

| 항목 | economy.md (정규) | enhancement-system.md (구버전) |
|-----|-----------------|-------------------------------|
| +0→+1 골드 | 100 | 50 |
| +9→+10 골드 | 5,000 | 10,000 |
| 강화석 분류 | 단일 강화석 | 하급/중급/상급 3등급 |

강화석 등급 분리 여부는 post-MVP 검토 사항으로 보류한다.
MVP에서는 단일 강화석 1종으로 단순화한다.
