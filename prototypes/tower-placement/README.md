// PROTOTYPE - NOT FOR PRODUCTION
// Question: Is slot-based tower placement + wave defense fun in a web browser?
// Date: 2026-03-25

# Tower Placement Prototype

## 실행 방법

브라우저에서 `index.html`을 열면 됩니다.

```bash
# macOS
open index.html

# 또는 로컬 서버로 실행
python3 -m http.server 8080
# 브라우저에서 http://localhost:8080 접속
```

현재 작업 루트에서 바로 테스트할 때는 아래 경로를 권장합니다.

```bash
cd /Users/krnomad/work/ai/codex-game-example
python3 -m http.server 4173 --bind 127.0.0.1
# 브라우저에서 http://127.0.0.1:4173/prototypes/tower-placement/ 접속
```

플레이 중 확인할 포인트는 [PLAYTEST-CHECKLIST.md](PLAYTEST-CHECKLIST.md)를 기준으로 봅니다.

## 조작법

1. 하단 영웅 패널에서 영웅 선택 (클릭)
2. 맵의 빈 슬롯(+ 표시) 클릭하여 배치
3. "▶ 웨이브 시작" 버튼으로 전투 시작
4. 이미 배치된 슬롯 클릭 시 업그레이드 (골드 소모)
5. 좌측 하단 스킬 버튼으로 영웅 스킬 발동 (전투 중만)
6. 우측 패널 `🔊 ON/OFF` 버튼으로 사운드 토글

## 영웅

| 영웅 | 타입 | 코스트 | 스킬 |
|------|------|--------|------|
| ⚔️ 무사 | 근접 고데미지 | 30 | 질풍참 (범위 폭발) |
| 🏹 궁수 | 원거리 딜러 | 25 | 만궁술 (연사 강화) |
| 🔮 도사 | 범위 공격 | 40 | 뇌전술 (연쇄 번개) |
| 🌸 무녀 | 감속 지원 | 35 | 결계 (전체 감속) |

## 현재 빌드 포커스

- 브리핑 패널이 첫 행동을 충분히 안내하는가
- 고지대 사거리 보너스가 체감되는가
- 스킬 타이밍이 후반 웨이브 생존에 실제로 기여하는가
- 가장 앞선 적을 우선 타격하는 규칙이 전략적으로 읽히는가
