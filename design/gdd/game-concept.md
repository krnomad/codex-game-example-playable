# Game Concept: 풍운지기 (風雲之器)

*Created: 2026-03-25*
*Status: Draft*

---

## Elevator Pitch

> 바람의나라 감성의 한국 판타지 픽셀아트 타워디펜스.
> 영웅을 배치하고, 지도자를 선택해 운영 방향을 바꾸고, 보물 공방으로 유물을 강화하며
> 요괴 군단의 침공으로부터 마을을 지켜라.
> Kingdom Rush의 전략적 배치 + 수집형 영웅 성장 + 리스크형 메타 강화가 만나는 웹 브라우저 게임.

---

## Core Identity

| Aspect | Detail |
| ---- | ---- |
| **Genre** | Tower Defense + Hero Collection |
| **Platform** | Web Browser (Godot 4 웹 내보내기) |
| **Target Audience** | 레트로 감성을 좋아하는 캐주얼~미드코어 전략 게이머 |
| **Player Count** | Single-player |
| **Session Length** | 15-30분 |
| **Monetization** | 미정 (무료 웹 게임 우선, 추후 결정) |
| **Estimated Scope** | Small (1-2개월) |
| **Comparable Titles** | Kingdom Rush, Arknights, 바람의나라 + 리니지클래식 (비주얼/강화 참조) |

---

## Core Fantasy

고대 한국 판타지 세계의 **수호자**가 되어, 수묵화 풍의 아름다운 세계에서
다양한 영웅들을 이끌고 요괴 군단의 침공을 막아내는 경험.

플레이어는 단순한 지휘관이 아니라, 각기 다른 능력과 이야기를 가진 영웅들을
모으고 성장시키며, 그들의 힘으로 점점 강해지는 어둠의 세력에 맞서는
**수집가이자 전략가**이다.

---

## Unique Hook

Kingdom Rush 스타일의 검증된 타워디펜스 배치 전략에, **바람의나라 + 리니지클래식
감성의 한국 판타지 픽셀아트**, **지도자 선택으로 운영 철학을 바꾸는 메타 레이어**,
그리고 **보물 공방 확률 강화**를 결합.

"Kingdom Rush 같은 전략적 타워디펜스, **그런데** 바람의나라 스타일 픽셀아트에
지도자를 고르고, 영웅을 배치하고, 리니지처럼 강화 성공/실패의 짜릿함이 있다."

한국 신화/판타지 기반 TD는 시장에 거의 부재하며, 강화 시스템이 만드는
"한 번만 더" 중독성이 TD의 "한 웨이브만 더" 심리와 이중으로 작동한다.

---

## Player Experience Analysis (MDA Framework)

### Target Aesthetics (What the player FEELS)

| Aesthetic | Priority | How We Deliver It |
| ---- | ---- | ---- |
| **Sensation** (sensory pleasure) | 2 | 바람의나라 풍 픽셀아트, 한국적 사운드, 타격 이펙트 |
| **Fantasy** (make-believe) | 3 | 한국 판타지 세계의 수호자 역할 |
| **Narrative** (drama) | 6 | 스테이지별 간단한 배경 스토리 |
| **Challenge** (mastery) | 1 | 웨이브 난이도 곡선, 타워 배치 최적화, 보스전 |
| **Fellowship** (social) | N/A | 싱글플레이어 |
| **Discovery** (exploration) | 5 | 새 영웅 해금, 숨겨진 조합 시너지 발견 |
| **Expression** (self-expression) | 4 | 영웅 조합 빌드, 배치 전략 |
| **Submission** (relaxation) | 7 | 낮은 난이도 스테이지 반복 파밍 |

### Key Dynamics (Emergent player behaviors)

- 플레이어가 영웅 간 **시너지 조합**과 지도자 조합을 실험하며 최적의 팀을 찾음
- 어려운 스테이지에서 **배치 위치를 조정**하며 반복 도전
- 정비 구간마다 **보물 공방 확률 강화**를 시도하며 다음 웨이브의 기대값을 조절
- 새 영웅을 얻기 위해 **다양한 스테이지를 클리어**하려는 동기
- 보스 웨이브 직전 **스킬 타이밍을 계산**하는 긴장감

### Core Mechanics (Systems we build)

1. **타워(영웅) 배치 시스템** — 슬롯 기반 배치, 위치별 전략적 가치 차이
2. **웨이브 방어 시스템** — 적 경로, 웨이브 구성, 보스 등장
3. **영웅 수집/성장 시스템** — 영웅 획득, 레벨업, 스킬 해금
4. **영웅 강화 시스템** — 리니지클래식 풍 +1~+10 강화, 성공/실패 도박, 보호 아이템 ([상세](enhancement-system.md))
5. **스킬 발동 시스템** — 영웅별 액티브 스킬, 쿨다운 관리
6. **지도자 시스템** — 전투 전 지도자 선택, XP, 레벨업, 재능 트리 ([상세](leader-system.md))
7. **보물 공방 시스템** — 웨이브/엘리트/보스 보상으로 얻은 보물로 유물 확률 강화 ([상세](treasure-forge.md))
8. **스테이지 진행 시스템** — 챕터/스테이지 맵, 별점 평가, 해금

---

## Player Motivation Profile

### Primary Psychological Needs Served

| Need | How This Game Satisfies It | Strength |
| ---- | ---- | ---- |
| **Autonomy** (freedom, meaningful choice) | 영웅 선택, 배치 위치, 스킬 타이밍 — 모든 것이 플레이어 결정 | Core |
| **Competence** (mastery, skill growth) | 웨이브 클리어, 별 3개 달성, 더 어려운 스테이지 돌파 | Core |
| **Relatedness** (connection, belonging) | 영웅 캐릭터와의 유대, 수집 완성의 소속감 | Supporting |

### Player Type Appeal (Bartle Taxonomy)

- [x] **Achievers** — 영웅 수집 완성, 별점 올클리어, 스테이지 진행
- [x] **Explorers** — 영웅 시너지 발견, 새 스테이지/영웅 해금
- [ ] **Socializers** — 해당 없음 (싱글플레이어)
- [ ] **Killers/Competitors** — 해당 없음 (PvE 전용)

### Flow State Design

- **온보딩 곡선**: 첫 3 스테이지에서 배치 → 업그레이드 → 스킬 순으로 하나씩 가르침
- **난이도 스케일링**: 웨이브 수 증가, 적 유형 다양화, 보스 등장 주기
- **피드백 명확성**: 데미지 숫자, 처치 이펙트, 웨이브 클리어 팡파르
- **실패 복구**: 즉시 재시도 가능, 실패 시 어떤 영웅/배치가 부족했는지 힌트 제공

---

## Core Loop

### Moment-to-Moment (30 seconds)
타워 배치 슬롯에 영웅을 놓고, 밀려오는 요괴를 관찰하며, 위기 시
영웅 스킬을 발동한다. 처치 시 동전과 이펙트가 터지며 즉각적인 쾌감.

### Short-Term (5-15 minutes)
지도자 선택 → 웨이브 시작 → 적 경로 확인 → 타워 배치/업그레이드 → 웨이브 방어
→ 보상 획득 → 보물 공방 강화 → 다음 웨이브 준비. "이번 웨이브만 더" 심리.

### Session-Level (15-30 minutes)
스테이지 선택 → 지도자 선택 → 5-8 웨이브 클리어 → 별점 평가(1-3성) → 보상(골드, 보물, 영웅 조각)
→ 영웅/유물/지도자 성장 → 다음 스테이지 도전 또는 이전 스테이지 3성 도전.

### Long-Term Progression
- 영웅 도감 완성 (8-12종 수집)
- 각 영웅 레벨업 및 스킬 해금
- 지도자별 재능 트리 분기 완성
- 유물 세트별 강화 방향 최적화
- 챕터 진행 (새로운 지역, 새로운 적 유형)
- 하드 모드/도전 스테이지 해금

### Retention Hooks
- **Curiosity**: 다음 스테이지에서 어떤 새 적/보스가? 어떤 지도자/유물 조합이 더 강할까?
- **Investment**: 키운 영웅에 대한 애착, 컬렉션 진행도, **강화 단계에 대한 집착**
- **Gambling Thrill**: "이번에는 +7 성공할 수 있을까? 이번 보물 강화는 붙을까?" — 이중 강화 루프의 중독성
- **Social**: N/A (싱글플레이어, 단 고강화 달성 시 전설 알림 연출)
- **Mastery**: 3성 클리어 못한 스테이지 도전, 더 효율적인 배치 발견

---

## Game Pillars

### Pillar 1: 한 판의 긴장감
매 웨이브가 "간신히 버텼다"는 느낌을 줘야 한다. 쉬운 승리보다 아슬아슬한
방어가 더 재밌다.

*Design test*: "이 기능이 방어의 긴장감을 높이는가? 아니면 게임을 너무 쉽게
만드는가?" → 긴장감을 높이는 쪽을 선택한다.

### Pillar 2: 수집과 강화의 쾌감
새 영웅을 얻고, 강화해서 빛나게 만드는 것이 계속 플레이하는 가장 큰 이유.
영웅마다 시각적으로 매력적이고, 강화 시 화려한 오라와 이펙트로 보상감을 줘야 한다.
리니지클래식의 강화 성공 순간의 짜릿함을 재현한다.

*Design test*: "이 영웅이 기존 영웅과 확실히 다른 플레이 경험을 주는가?
강화했을 때 시각적/성능적으로 '키웠다'는 보람이 확실한가?" →
단순 수치 차이가 아닌 역할/메카닉 차이 + 강화 시 시각적 변화가 있어야 한다.

### Pillar 2.5: 운영 철학 선택
같은 영웅 조합이라도 어떤 지도자를 고르고 어떤 유물을 강화했는지에 따라
전혀 다른 운영 감각이 나와야 한다.

*Design test*: "이 선택이 단순 수치 상승이 아니라 플레이 방식의 해석을 바꾸는가?"
→ 공격형, 경제형, 스킬형 중 최소 하나의 운영 감각 차이가 분명해야 한다.

### Pillar 3: 바람의나라 감성
한국 판타지 픽셀아트 분위기가 이 게임의 정체성. 모든 비주얼과 사운드가
한국 고전 판타지 세계관과 일관되어야 한다.

*Design test*: "이 에셋/이펙트가 바람의나라 세계에 있어도 어색하지 않은가?" →
현대적이거나 서양 판타지 느낌이면 거부한다.

### Anti-Pillars (What This Game Is NOT)

- **NOT 복잡한 실시간 마이크로** — 배치와 스킬 외 복잡한 조작 없음. 웹 브라우저에서 쾌적해야 함
- **NOT PvP** — 1-2개월 스코프에서 PvP 밸런싱 불가. PvE에 전념
- **NOT 오픈월드/자유 탐색** — 스테이지 기반 선형 진행. 산만함 방지
- **NOT 가챠/과금 중심** — 모든 영웅을 플레이로 획득 가능해야 함

---

## Inspiration and References

| Reference | What We Take From It | What We Do Differently | Why It Matters |
| ---- | ---- | ---- | ---- |
| Kingdom Rush | 슬롯 기반 배치, 웨이브 구조, 영웅 스킬 | 수집형 영웅 시스템, 한국 판타지 세계관 | TD 배치 시스템의 황금 표준 |
| Arknights | 수집형 캐릭터 TD, 캐릭터별 고유 역할 | 실시간 배치가 아닌 사전 배치, 웹 브라우저 접근성 | 수집형 TD의 상업적 성공 증명 |
| 바람의나라 | 한국 판타지 픽셀아트 감성, 수묵화 분위기 | TD 장르로 변환, 전투 중심 | 비주얼 정체성의 원천 |
| 리니지클래식 | 강화 성공/실패 도박, 장도리 연출, +7 빛나는 무기 | 영웅 강화(장비 아님), 파괴 없음, Pity 시스템 | 강화 중독성의 원천, 한국 게이머 공감대 |

**Non-game inspirations**: 한국 전통 수묵화, 산해경/한국 신화 속 요괴와 영물,
조선시대 복식/건축 양식, 전통 대장간/화로 (강화 연출 레퍼런스)

---

## Target Player Profile

| Attribute | Detail |
| ---- | ---- |
| **Age range** | 20-40대 |
| **Gaming experience** | 캐주얼~미드코어 |
| **Time availability** | 15-30분 짧은 세션 (점심시간, 출퇴근) |
| **Platform preference** | 웹 브라우저 (PC/모바일 모두) |
| **Current games they play** | Kingdom Rush, Arknights, 각종 웹/모바일 TD |
| **What they're looking for** | 짧은 시간에 전략적 재미 + 수집/성장 + 한국적 감성 |
| **What would turn them away** | 과도한 과금 압박, 지나치게 복잡한 조작, 느린 로딩 |

---

## Technical Considerations

| Consideration | Assessment |
| ---- | ---- |
| **Recommended Engine** | Godot 4 — 2D 픽셀아트 최적화, 웹 내보내기 기본 지원, 무료 |
| **Key Technical Challenges** | 웹 성능 최적화 (다수 적 유닛 동시 렌더링), 세이브 시스템 (로컬 스토리지) |
| **Art Style** | 32x32 한국 판타지 픽셀아트 (바람의나라 + 리니지클래식 감성) |
| **Art Pipeline Complexity** | Medium (커스텀 2D 픽셀 스프라이트) |
| **Audio Needs** | Moderate (한국 전통 악기 풍 BGM, 전투 효과음) |
| **Networking** | None (싱글플레이어, 로컬 세이브) |
| **Content Volume** | 스테이지 8-10개, 영웅 8-12종, 적 유형 6-8종, 보스 2-3종 |
| **Procedural Systems** | 없음 (핸드크래프트 스테이지) |

---

## Risks and Open Questions

### Design Risks
- 영웅 간 밸런스가 맞지 않으면 수집 동기 저하 (일부 영웅만 사용)
- 스테이지 수가 적어 리플레이 가치가 부족할 수 있음

### Technical Risks
- Godot 4 웹 내보내기 성능 (많은 유닛 동시 처리 시)
- 브라우저 간 호환성 (특히 모바일 브라우저)

### Market Risks
- TD 장르는 레드오션이지만, 한국 판타지 니치는 블루오션
- 웹 게임 시장에서의 발견성(discoverability)

### Scope Risks
- 픽셀아트 에셋 제작이 예상보다 오래 걸릴 수 있음
- 지도자/보물 공방 추가로 메타 시스템 밸런싱 부하가 커질 수 있음
- 1-2개월 안에 8-10 스테이지 + 밸런싱이 빠듯할 수 있음

### Open Questions
- 영웅 획득 방식: 스테이지 클리어 보상 vs 상점 구매 vs 조합? → 프로토타입에서 테스트
- 32x32 vs 16x16 픽셀 크기: 웹에서의 가독성 테스트 필요
- 세이브 데이터: LocalStorage vs IndexedDB → 용량에 따라 결정
- 보물 공방 성공 확률과 피티 수치가 “손맛”과 “좌절” 사이 어디에 놓여야 하는가?

---

## MVP Definition

**Core hypothesis**: "한국 판타지 픽셀아트 세계에서 영웅을 배치해 요괴 웨이브를
막는 것이 15분 이상 재미있는가?"

**Required for MVP**:
1. 슬롯 기반 타워 배치 + 웨이브 시스템 (단일 프로토타입 스테이지 기준 8웨이브)
2. 영웅 4종 (각기 다른 역할: 근접/원거리/범위/지원)
3. 적 유형 5종 + 보스 1종 + 후반 엘리트 변형
4. 지휘실형 HUD (배치, 웨이브 정보, 결과 화면, 지도자 패널, 공방 진입)
5. 지도자 3명 선택 + XP/레벨업 + 재능 트리
6. 보물 공방 유물 4종 확률 강화
7. 상태별 BGM/SFX와 결과 리포트

**Explicitly NOT in MVP** (defer to later):
- 영웅 레벨업/성장 시스템
- 스토리/내러티브
- 세이브 시스템
- 장비 인벤토리와 유물 세트 조합
- 지도자 전용 궁극기

### Scope Tiers

| Tier | Content | Features | Timeline |
| ---- | ---- | ---- | ---- |
| **MVP** | 1 고밀도 프로토타입 스테이지, 4 영웅, 5 적 + 엘리트, 지도자 3, 유물 4 | 배치 + 웨이브 + 스킬 + 지도자 + 보물 공방 + 오디오/HUD | 2-3주 |
| **Vertical Slice** | 3 스테이지, 6 영웅, 6 적, 보스 2 | + 영웅 성장, 세이브, 위험 강화(+6~+7), 유물 세트화 | 4-5주 |
| **Alpha** | 8 스테이지, 8 영웅, 6 적, 보스 3 | + 스토리, 도감, 전체 강화(+10), 보호 아이템 | 6-7주 |
| **Full Vision** | 10+ 스테이지, 12 영웅, 8 적, 보스 3+ | + 하드모드, 도전, 전용 지도자 궁극기, 메타 폴리시 | 8-9주 |

---

## Next Steps

- [ ] 컨셉 검증 — `/design-review design/gdd/game-concept.md`
- [ ] VFX GDD 추가 — 지도자/보물 공방/엘리트 적 연출 언어 정리
- [ ] 프로토타입 밸런싱 — 후반 난이도, 보물 드랍량, 강화 확률 재조정
- [ ] 시스템 분해 재정리 — 지도자/보물 공방을 포함한 의존성 갱신
- [ ] 첫 스프린트 계획 — `/sprint-plan new`
