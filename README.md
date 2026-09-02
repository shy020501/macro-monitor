# Macro Monitor

Next.js, TypeScript, Tailwind CSS, shadcn/ui, and local Supabase 기반의 개인용 경제·시장 모니터링 앱입니다.

## 로컬 실행

```powershell
pnpm install
pnpm exec supabase start
pnpm exec supabase migration up --local
pnpm dev
```

`http://localhost:3000`에서 앱을 확인할 수 있습니다.

## 데이터 Provider 설정

현재 수동 동기화는 일봉(`1d`)만 활성화되어 있습니다. 차트의 `1m`~`5H` 구간도 임시 비활성화되어 `1D`, `1W`, `1M`만 선택할 수 있습니다. scheduler/cron은 아직 연결하지 않았습니다.

| 지표 | Provider | 설정 |
| --- | --- | --- |
| CPI, 미국 2년물 금리 | FRED | `FRED_API_KEY` |
| DXY, 미국 10년물 금리, S&P 500, KOSPI, WTI 근월물 선물, USD/KRW | Python yfinance | API key 없음 |
| GOLD (XAU/USD 현물) | Alpha Vantage | `ALPHA_VANTAGE_API_KEY` |

`.env.example`을 `.env.local`로 복사한 뒤 Supabase service-role key와 두 API key를 입력합니다. 키는 서버/CLI에서만 읽으며 `NEXT_PUBLIC_` 접두사를 사용하지 않습니다.

yfinance Python 의존성은 한 번 설치합니다.

```powershell
pnpm setup:market
```

`python`이 PATH에 없으면 `.env.local`의 `YFINANCE_PYTHON_PATH`에 Python 실행 파일의 절대 경로를 지정합니다.

## 수동 동기화

```powershell
# CPI와 US2Y
pnpm sync:fred

# 설정된 시장 지표 전체
pnpm sync:market

# 한 지표만
pnpm sync:market --indicator DXY
pnpm sync:market --indicator GOLD
```

첫 라이브 동기화는 indicator 메타데이터의 `sync_start_date`에서 시작합니다. 새 provider가 한 건 이상 정상 수신된 지표에 한해서만 seed 및 이전 provider observation을 제거하므로 source가 섞이지 않습니다. 실패하거나 빈 응답이면 기존 데이터를 유지합니다. 이후에는 최신 저장 시점의 다음 날부터 증분 수집하며, `(indicator_id, observed_at)` unique constraint로 재실행 시 중복을 방지합니다.

주의: yfinance는 Yahoo Finance의 비공식 Python wrapper이며 개인 연구 용도에 맞춘 선택입니다. WTI는 원유 현물이 아니라 `CL=F` 근월물 선물입니다. GOLD만 Alpha Vantage의 XAU/USD 현물 계열을 사용해 선물과 구분합니다.

## 검증

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec supabase db lint
```
