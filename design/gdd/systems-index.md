# Systems Index: 풍운지기 (風雲之器)

> **Status**: Draft
> **Created**: 2026-03-28
> **Last Updated**: 2026-03-28
> **Source Concept**: design/gdd/game-concept.md

---

## Overview

풍운지기는 한국 판타지 픽셀아트 타워디펜스 + 영웅 수집/강화 웹 브라우저 게임이다.
핵심 루프는 "영웅 배치 → 웨이브 방어 → 보상 획득 → 영웅 강화 → 다음 스테이지 도전"이며,
이를 구동하기 위해 21개 시스템이 필요하다. 게임의 3대 기둥(긴장감, 수집/강화 쾌감,
바람의나라 감성)을 모두 지탱하는 구조여야 한다.

---

## Systems Enumeration

| # | System Name | Category | Priority | Status | Design Doc | Depends On |
|---|-------------|----------|----------|--------|------------|------------|
| 1 | 데이터 설정 (Data Config) | Core | MVP | Designed | [data-config.md](data-config.md) | — |
| 2 | 유닛 기반 (Unit Base) | Core | MVP | Designed | [unit-base.md](unit-base.md) | Data Config |
| 3 | Input/Control | Core | MVP | Designed | [input-control.md](input-control.md) | — |
| 4 | 전투/데미지 계산 (Combat) | Gameplay | MVP | Designed | [combat-damage.md](combat-damage.md) | Unit Base, Data Config |
| 5 | 적 경로/AI (Enemy Path) | Gameplay | MVP | Designed | [enemy-path-ai.md](enemy-path-ai.md) | Unit Base, Data Config |
| 6 | 타워(영웅) 배치 (Placement) | Gameplay | MVP | Designed | [hero-placement.md](hero-placement.md) | Unit Base, Data Config, Input/Control |
| 7 | 경제 시스템 (Economy) | Economy | MVP | Designed | [economy.md](economy.md) | Data Config |
| 8 | 웨이브 방어 (Wave Defense) | Gameplay | MVP | Designed | [wave-defense.md](wave-defense.md) | Enemy Path, Placement, Combat, Economy |
| 9 | 스킬 발동 (Skill Activation) | Gameplay | MVP | Designed | [skill-activation.md](skill-activation.md) | Combat, Unit Base, Data Config |
| 10 | 영웅 강화 (Enhancement) | Progression | MVP | Approved | [enhancement-system.md](enhancement-system.md) | Hero Collection, Economy, Item/Inventory, Data Config |
| 11 | VFX/파티클 (VFX) | Presentation | MVP | Not Started | — | Combat, Skill, Enhancement, Unit Base |
| 12 | 전투 HUD (Battle HUD) | UI | MVP | Designed | [battle-hud.md](battle-hud.md) | Wave Defense, Placement, Skill, Economy, Input/Control |
| 13 | 강화 UI (Enhancement UI) | UI | MVP | Not Started | — | Enhancement, VFX, Input/Control |
| 14 | 지도자 시스템 (Leader System) | Progression | MVP | Designed | [leader-system.md](leader-system.md) | Battle HUD, Wave Defense, Economy, Skill Activation |
| 15 | 보물 공방 (Treasure Forge) | Economy | MVP | Designed | [treasure-forge.md](treasure-forge.md) | Economy, Wave Defense, Battle HUD, Leader System |
| 16 | 영웅 수집/성장 (Hero Collection) | Progression | VS | Not Started | — | Unit Base, Economy, Data Config |
| 17 | Item/Inventory | Economy | VS | Not Started | — | Economy, Data Config |
| 18 | 세이브/로드 (Save/Load) | Persistence | VS | Not Started | — | Hero Collection, Enhancement, Stage Progression, Economy, Item/Inventory |
| 19 | Audio/SFX | Presentation | VS | Not Started | — | Combat, Skill, Enhancement, Wave Defense |
| 20 | 영웅 관리 UI (Hero Mgmt UI) | UI | VS | Not Started | — | Hero Collection, Enhancement, Input/Control |
| 21 | 스테이지 진행 (Stage Progression) | Gameplay | Alpha | Not Started | — | Wave Defense, Economy, Hero Collection |
| 22 | 스테이지 선택 UI (Stage Select UI) | UI | Alpha | Not Started | — | Stage Progression, Input/Control |
| 23 | 튜토리얼/온보딩 (Tutorial) | Meta | Full | Not Started | — | Battle HUD, Placement, Skill, Enhancement UI |

---

## Categories

| Category | Description |
|----------|-------------|
| **Core** | 모든 시스템이 의존하는 기반 — 데이터 포맷, 유닛 구조, 입력 처리 |
| **Gameplay** | 게임을 재미있게 만드는 핵심 메카닉 — 전투, 배치, 웨이브, 스킬 |
| **Progression** | 플레이어 성장 — 영웅 수집, 강화, 레벨업 |
| **Economy** | 자원 생성과 소비 — 골드, 강화석, 아이템, 파편 |
| **Persistence** | 게임 상태 저장 — 세이브/로드, 설정 |
| **UI** | 플레이어 대면 인터페이스 — HUD, 메뉴, 강화 화면, 도감 |
| **Presentation** | 시청각 피드백 — VFX, 오디오 |
| **Meta** | 핵심 루프 바깥 — 튜토리얼, 접근성 |

---

## Priority Tiers

| Tier | Definition | Target Milestone | Design Urgency |
|------|------------|------------------|----------------|
| **MVP** | 핵심 루프 작동에 필수. "이게 재미있나?" 테스트 가능 | 첫 플레이 가능 빌드 | 최우선 설계 |
| **Vertical Slice (VS)** | 완전한 1회 세션 경험. 수집→강화→세이브 흐름 완성 | 버티컬 슬라이스 | 2순위 설계 |
| **Alpha** | 다중 스테이지 진행, 전체 콘텐츠 구조 | 알파 빌드 | 3순위 설계 |
| **Full Vision** | 폴리시, 온보딩, 접근성 | 베타/릴리스 | 필요 시 설계 |

---

## Dependency Map

### Foundation Layer (의존성 없음)

1. **데이터 설정** — 모든 밸런스 값(스탯, 확률, 비용)의 원천. 이 포맷이 확정되어야 다른 시스템이 데이터를 소비할 수 있음
2. **유닛 기반** — 영웅과 적의 공통 구조(HP, 스탯, 위치, 상태). 전투/배치/AI 모두 이 위에서 동작
3. **Input/Control** — 마우스(PC) + 터치(모바일) 통합 입력 추상화. 모든 인터랙티브 시스템이 소비

### Core Layer (Foundation에 의존)

4. **전투/데미지 계산** — Unit Base, Data Config → 데미지 공식, 사거리 판정, 강화 배율 적용
5. **적 경로/AI** — Unit Base, Data Config → 경로 이동, 보스 특수 행동
6. **타워(영웅) 배치** — Unit Base, Data Config, Input/Control → 슬롯 선택, 영웅 드래그 배치
7. **경제 시스템** — Data Config → 골드/강화석/파편 잔고 관리, 파우셋-싱크 추적

### Feature Layer (Core에 의존)

8. **웨이브 방어** — Enemy Path, Placement, Combat, Economy → 웨이브 스폰, 클리어 판정, 보상 지급
9. **스킬 발동** — Combat, Unit Base, Data Config → 스킬 트리거, 쿨다운, 범위 효과
10. **영웅 강화** — Hero Collection, Economy, Item/Inventory, Data Config → 강화 확률, Pity, 스탯 적용. **(GDD 완료)**
11. **영웅 수집/성장** — Unit Base, Economy, Data Config → 영웅 획득, 레벨업, 스킬 해금
12. **Item/Inventory** — Economy, Data Config → 보호 아이템 스택, 사용 트랜잭션, 파편 교환
13. **지도자 시스템** — Battle HUD, Wave Defense, Economy, Skill Activation → 전투 전 선택, XP, 레벨업, 재능 트리
14. **보물 공방** — Economy, Wave Defense, Battle HUD, Leader System → 웨이브/엘리트/보스 보물 드랍, 유물 확률 강화, 실패 누적 보정
15. **스테이지 진행** — Wave Defense, Economy, Hero Collection → 챕터 맵, 별점, 해금 조건

### Presentation Layer (Feature에 의존)

16. **VFX/파티클** — Combat, Skill, Enhancement, Unit Base → 오라, 스킬 이펙트, 처치 이펙트
17. **Audio/SFX** — Combat, Skill, Enhancement, Wave Defense → 타격음, 강화 연출 사운드, BGM
18. **전투 HUD** — Wave Defense, Placement, Skill, Economy, Input/Control → HP바, 웨이브 카운터, 스킬 버튼, 지도자 패널, 보물 공방 진입점
19. **강화 UI** — Enhancement, VFX, Input/Control → 대장간 화면, 모루 연출, 불운 게이지
20. **영웅 관리 UI** — Hero Collection, Enhancement, Input/Control → 도감, 팀 편성, 영웅 상세
21. **스테이지 선택 UI** — Stage Progression, Input/Control → 챕터 맵, 별점, 해금 표시

### Persistence Layer

22. **세이브/로드** — Hero Collection, Enhancement, Stage Progression, Economy, Item/Inventory → LocalStorage/IndexedDB 영속화

### Polish Layer (전체에 의존)

23. **튜토리얼/온보딩** — Battle HUD, Placement, Skill, Enhancement UI → 단계별 교육 흐름

---

## Recommended Design Order

| Order | System | Priority | Layer | Est. Effort |
|-------|--------|----------|-------|-------------|
| 1 | 데이터 설정 (Data Config) | MVP | Foundation | S |
| 2 | 유닛 기반 (Unit Base) | MVP | Foundation | S |
| 3 | Input/Control | MVP | Foundation | S |
| 4 | 전투/데미지 계산 (Combat) | MVP | Core | M |
| 5 | 적 경로/AI (Enemy Path) | MVP | Core | M |
| 6 | 타워(영웅) 배치 (Placement) | MVP | Core | M |
| 7 | 경제 시스템 (Economy) | MVP | Core | S |
| 8 | 웨이브 방어 (Wave Defense) | MVP | Feature | L |
| 9 | 스킬 발동 (Skill Activation) | MVP | Feature | **완료** |
| 10 | 영웅 강화 (Enhancement) | MVP | Feature | **완료** |
| 11 | VFX/파티클 (VFX) | MVP | Presentation | M |
| 12 | 전투 HUD (Battle HUD) | MVP | Presentation | **완료** |
| 13 | 강화 UI (Enhancement UI) | MVP | Presentation | M |
| 14 | 지도자 시스템 (Leader System) | MVP | Feature | M |
| 15 | 보물 공방 (Treasure Forge) | MVP | Feature | M |
| 16 | 영웅 수집/성장 (Hero Collection) | VS | Feature | M |
| 17 | Item/Inventory | VS | Feature | S |
| 18 | 세이브/로드 (Save/Load) | VS | Persistence | M |
| 19 | Audio/SFX | VS | Presentation | M |
| 20 | 영웅 관리 UI (Hero Mgmt UI) | VS | Presentation | S |
| 21 | 스테이지 진행 (Stage Progression) | Alpha | Feature | M |
| 22 | 스테이지 선택 UI (Stage Select UI) | Alpha | Presentation | S |
| 23 | 튜토리얼/온보딩 (Tutorial) | Full | Polish | M |

> Effort: **S** = 1 세션, **M** = 2-3 세션, **L** = 4+ 세션
> "세션" = GDD 1개를 완성하는 집중 설계 대화 1회

---

## Circular Dependencies

- **없음** — 모든 의존성이 상위→하위 단방향으로 흐름

---

## High-Risk Systems

| System | Risk Type | Risk Description | Mitigation |
|--------|-----------|-----------------|------------|
| 웨이브 방어 | Technical | 다수 적 동시 렌더링 시 웹 브라우저 성능 저하 | Godot 4.6 웹 내보내기로 프로토타입 성능 테스트 선행 |
| 영웅 강화 | Design | 강화 확률/비용 밸런스가 재미와 좌절 사이의 줄타기 | Pity 시스템 + 하한선으로 안전장치 확보, 플레이테스트로 검증 |
| VFX/파티클 | Technical | 강화 오라 8기 동시 표시 + 스킬 이펙트 시 파티클 버짓 초과 | 파티클 200개 상한, 저사양 모드 50% 감소 옵션 |
| 세이브/로드 | Technical | LocalStorage 5MB 제한, IndexedDB 브라우저 호환성 | 세이브 데이터 크기 추정 후 방식 결정, 직렬화 포맷 경량화 |

---

## Progress Tracker

| Metric | Count |
|--------|-------|
| Total systems identified | 23 |
| Design docs started | 13 |
| Design docs reviewed | 0 |
| Design docs approved | 1 (Enhancement) |
| MVP systems designed | 13 / 15 |
| Vertical Slice systems designed | 0 / 5 |
| Alpha systems designed | 0 / 2 |
| Full Vision systems designed | 0 / 1 |

---

## Next Steps

- [ ] VFX GDD 설계 시작 — 스킬/강화/보스 신호의 시각 언어 정리
- [ ] Leader/ Treasure Forge를 기준으로 실제 Godot 데이터 모델과 저장 범위 확정
- [ ] 각 완성된 GDD에 `/design-review` 실행
- [ ] MVP 시스템 설계 완료 후 `/gate-check pre-production`
- [ ] 고위험 시스템(웨이브 방어) 프로토타입 — `/prototype wave-performance`
- [ ] 첫 스프린트 계획 — `/sprint-plan new`
