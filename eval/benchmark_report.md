# Cache Benchmark Report

> **Dataset**: 100 queries &nbsp;|&nbsp; **Baseline p95**: 651.17 ms &nbsp;|&nbsp; **Cached p95**: 220.03 ms

## Latency Summary

| Metric | Baseline (no cache) | Cached (warm) | Speedup |
|--------|--------------------:|---------------:|--------:|
| Mean   | 554.81 ms | 164.18 ms | **3.38×** |
| p50    | 527.4 ms | 159.38 ms | **3.31×** |
| p95    | 651.17 ms | 220.03 ms | **2.96×** |
| p99    | 729.89 ms | 236.93 ms | **3.08×** |
| Min    | 478.18 ms | 118.11 ms | — |
| Max    | 1769.92 ms | 273.17 ms | — |

## Cache Hit Rates (Timed Pass)

| Layer | Hit Rate |
|-------|----------|
| Embedding (Gemini API) | 50.0% |
| Vector Search (Qdrant) | 50.0% |

## Per-Query Detail

| # | Query | Baseline ms | Cached ms | Speedup |
|---|-------|------------:|----------:|--------:|
| 1 | which function calls db_check | 1769.92 | 162.67 | 10.88× |
| 2 | who calls db_check | 542.7 | 140.81 | 3.85× |
| 3 | which function calls validate_user | 528.52 | 168.05 | 3.15× |
| 4 | where is validate_user used | 490.29 | 144.42 | 3.4× |
| 5 | what does login do | 545.25 | 169.3 | 3.22× |
| 6 | show login flow | 541.11 | 166.01 | 3.26× |
| 7 | which functions are called by login | 529.82 | 121.93 | 4.35× |
| 8 | what does validate_user do | 602.35 | 208.73 | 2.89× |
| 9 | which functions are called by validate_user | 523.97 | 165.69 | 3.16× |
| 10 | what is the flow of validate_user | 553.1 | 173.28 | 3.19× |
| 11 | which function calls save_session | 511.53 | 224.54 | 2.28× |
| 12 | what does create_session do | 588.54 | 182.28 | 3.23× |
| 13 | which functions are called by create_session | 500.13 | 164.52 | 3.04× |
| 14 | which function calls log_attempt | 529.15 | 170.46 | 3.1× |
| 15 | what does db_check do | 513.7 | 206.0 | 2.49× |
| 16 | which function calls connect_db | 611.42 | 164.0 | 3.73× |
| 17 | who calls connect_db | 506.94 | 165.44 | 3.06× |
| 18 | where is db_check used | 620.18 | 151.53 | 4.09× |
| 19 | what is the flow of login | 513.82 | 150.66 | 3.41× |
| 20 | which functions are involved in login | 558.21 | 158.77 | 3.52× |
| 21 | how does login work | 518.14 | 146.04 | 3.55× |
| 22 | what does log_attempt do | 508.07 | 167.06 | 3.04× |
| 23 | which function calls create_session | 519.07 | 163.47 | 3.18× |
| 24 | how is session created | 533.96 | 147.95 | 3.61× |
| 25 | which functions are called inside create_session | 526.49 | 152.02 | 3.46× |
| 26 | what does save_session do | 542.97 | 175.46 | 3.09× |
| 27 | which function calls generate_token | 658.14 | 145.98 | 4.51× |
| 28 | what does generate_token do | 729.89 | 176.2 | 4.14× |
| 29 | where is generate_token used | 554.36 | 152.32 | 3.64× |
| 30 | which functions are involved in authentication | 535.7 | 149.17 | 3.59× |
| 31 | what happens during login process | 510.12 | 166.65 | 3.06× |
| 32 | which functions are part of database interaction | 524.44 | 166.99 | 3.14× |
| 33 | what functions connect to the database | 505.44 | 159.56 | 3.17× |
| 34 | which functions are indirectly involved in connect_db | 501.01 | 160.22 | 3.13× |
| 35 | which function calls db_check | 527.59 | 214.15 | 2.46× |
| 36 | who calls db_check | 702.03 | 273.17 | 2.57× |
| 37 | which function calls validate_user | 521.76 | 151.62 | 3.44× |
| 38 | where is validate_user used | 514.52 | 170.06 | 3.03× |
| 39 | what does login do | 544.06 | 154.55 | 3.52× |
| 40 | show login flow | 557.43 | 147.29 | 3.78× |
| 41 | which functions are called by login | 521.3 | 150.23 | 3.47× |
| 42 | what does validate_user do | 505.12 | 146.57 | 3.45× |
| 43 | which functions are called by validate_user | 480.68 | 170.09 | 2.83× |
| 44 | what is the flow of validate_user | 522.19 | 170.12 | 3.07× |
| 45 | which function calls save_session | 517.12 | 157.01 | 3.29× |
| 46 | what does create_session do | 541.62 | 167.0 | 3.24× |
| 47 | which functions are called by create_session | 586.56 | 236.93 | 2.48× |
| 48 | which function calls log_attempt | 601.35 | 186.53 | 3.22× |
| 49 | what does db_check do | 555.32 | 175.38 | 3.17× |
| 50 | which function calls connect_db | 493.25 | 174.3 | 2.83× |
| 51 | who calls connect_db | 543.36 | 151.06 | 3.6× |
| 52 | where is db_check used | 511.03 | 220.03 | 2.32× |
| 53 | what is the flow of login | 510.55 | 164.08 | 3.11× |
| 54 | which functions are involved in login | 478.18 | 144.69 | 3.3× |
| 55 | how does login work | 581.77 | 192.96 | 3.02× |
| 56 | what does log_attempt do | 506.26 | 131.22 | 3.86× |
| 57 | which function calls create_session | 643.54 | 151.54 | 4.25× |
| 58 | how is session created | 527.4 | 153.2 | 3.44× |
| 59 | which functions are called inside create_session | 569.85 | 159.38 | 3.58× |
| 60 | what does save_session do | 508.44 | 147.32 | 3.45× |
| 61 | which function calls generate_token | 502.06 | 163.03 | 3.08× |
| 62 | what does generate_token do | 519.81 | 151.74 | 3.43× |
| 63 | where is generate_token used | 695.12 | 154.13 | 4.51× |
| 64 | which functions are involved in authentication | 504.63 | 144.94 | 3.48× |
| 65 | what happens during login process | 546.48 | 160.14 | 3.41× |
| 66 | which functions are part of database interaction | 519.05 | 140.29 | 3.7× |
| 67 | what functions connect to the database | 518.94 | 143.38 | 3.62× |
| 68 | which functions are indirectly involved in connect_db | 512.15 | 153.0 | 3.35× |
| 69 | which function calls db_check | 491.2 | 166.25 | 2.95× |
| 70 | who calls db_check | 508.25 | 228.53 | 2.22× |
| 71 | which function calls validate_user | 525.58 | 196.79 | 2.67× |
| 72 | where is validate_user used | 565.97 | 146.65 | 3.86× |
| 73 | what does login do | 580.54 | 130.3 | 4.46× |
| 74 | show login flow | 626.84 | 183.82 | 3.41× |
| 75 | which functions are called by login | 651.17 | 135.48 | 4.81× |
| 76 | what does validate_user do | 491.52 | 131.67 | 3.73× |
| 77 | which functions are called by validate_user | 499.98 | 118.11 | 4.23× |
| 78 | what is the flow of validate_user | 495.02 | 194.61 | 2.54× |
| 79 | which function calls save_session | 494.94 | 152.14 | 3.25× |
| 80 | what does create_session do | 518.59 | 145.49 | 3.56× |
| 81 | which functions are called by create_session | 505.87 | 144.43 | 3.5× |
| 82 | which function calls log_attempt | 509.6 | 171.8 | 2.97× |
| 83 | what does db_check do | 505.93 | 148.85 | 3.4× |
| 84 | which function calls connect_db | 558.45 | 152.03 | 3.67× |
| 85 | who calls connect_db | 488.16 | 199.96 | 2.44× |
| 86 | where is db_check used | 543.6 | 134.7 | 4.04× |
| 87 | what is the flow of login | 514.78 | 227.8 | 2.26× |
| 88 | which functions are involved in login | 535.51 | 141.87 | 3.77× |
| 89 | how does login work | 630.8 | 175.71 | 3.59× |
| 90 | what does log_attempt do | 578.63 | 167.73 | 3.45× |
| 91 | which function calls create_session | 532.25 | 154.17 | 3.45× |
| 92 | how is session created | 599.34 | 161.29 | 3.72× |
| 93 | which functions are called inside create_session | 556.39 | 195.12 | 2.85× |
| 94 | what does save_session do | 527.04 | 142.38 | 3.7× |
| 95 | which function calls generate_token | 510.3 | 147.23 | 3.47× |
| 96 | what does generate_token do | 595.44 | 154.16 | 3.86× |
| 97 | where is generate_token used | 543.28 | 150.11 | 3.62× |
| 98 | which functions are involved in authentication | 560.27 | 137.13 | 4.09× |
| 99 | what happens during login process | 531.89 | 177.89 | 2.99× |
| 100 | which functions are part of database interaction | 564.92 | 144.85 | 3.9× |

## Key Takeaways

- **p95 improvement**: 651.17 ms → 220.03 ms (**2.96× faster**)
- Embedding cache eliminates Gemini API RTT for repeated queries (50.0% hit rate)
- Search cache eliminates Qdrant round-trip for identical vectors (50.0% hit rate)

_Generated by `eval/benchmark_cache.py`_