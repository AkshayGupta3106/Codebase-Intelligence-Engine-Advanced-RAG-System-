# Cache Benchmark Report

> **Dataset**: 100 queries &nbsp;|&nbsp; **Baseline p95**: 808.7 ms &nbsp;|&nbsp; **Cached p95**: 291.6 ms

## Latency Summary

| Metric | Baseline (no cache) | Cached (warm) | Speedup |
|--------|--------------------:|---------------:|--------:|
| Mean   | 516.24 ms | 187.75 ms | **2.75×** |
| p50    | 467.69 ms | 169.45 ms | **2.76×** |
| p95    | 808.7 ms | 291.6 ms | **2.77×** |
| p99    | 1167.87 ms | 457.85 ms | **2.55×** |
| Min    | 337.3 ms | 134.79 ms | — |
| Max    | 1187.69 ms | 504.06 ms | — |

## Cache Hit Rates (Timed Pass)

| Layer | Hit Rate |
|-------|----------|
| Embedding (Gemini API) | 50.0% |
| Vector Search (Qdrant) | 50.0% |

## Per-Query Detail

| # | Query | Baseline ms | Cached ms | Speedup |
|---|-------|------------:|----------:|--------:|
| 1 | which function calls db_check | 1187.69 | 504.06 | 2.36× |
| 2 | who calls db_check | 699.12 | 335.14 | 2.09× |
| 3 | which function calls validate_user | 440.59 | 264.17 | 1.67× |
| 4 | where is validate_user used | 474.68 | 200.52 | 2.37× |
| 5 | what does login do | 570.23 | 207.8 | 2.74× |
| 6 | show login flow | 451.49 | 266.35 | 1.7× |
| 7 | which functions are called by login | 516.5 | 308.6 | 1.67× |
| 8 | what does validate_user do | 514.17 | 153.78 | 3.34× |
| 9 | which functions are called by validate_user | 524.36 | 163.53 | 3.21× |
| 10 | what is the flow of validate_user | 449.01 | 162.59 | 2.76× |
| 11 | which function calls save_session | 453.27 | 135.95 | 3.33× |
| 12 | what does create_session do | 524.27 | 134.79 | 3.89× |
| 13 | which functions are called by create_session | 501.6 | 161.42 | 3.11× |
| 14 | which function calls log_attempt | 617.33 | 172.53 | 3.58× |
| 15 | what does db_check do | 557.13 | 219.6 | 2.54× |
| 16 | which function calls connect_db | 566.57 | 151.01 | 3.75× |
| 17 | who calls connect_db | 512.55 | 161.27 | 3.18× |
| 18 | where is db_check used | 582.42 | 185.78 | 3.14× |
| 19 | what is the flow of login | 521.04 | 135.54 | 3.84× |
| 20 | which functions are involved in login | 1031.78 | 144.87 | 7.12× |
| 21 | how does login work | 1167.87 | 176.13 | 6.63× |
| 22 | what does log_attempt do | 975.15 | 153.71 | 6.34× |
| 23 | which function calls create_session | 1070.31 | 217.95 | 4.91× |
| 24 | how is session created | 629.93 | 159.52 | 3.95× |
| 25 | which functions are called inside create_session | 417.05 | 243.53 | 1.71× |
| 26 | what does save_session do | 511.74 | 146.06 | 3.5× |
| 27 | which function calls generate_token | 718.78 | 146.35 | 4.91× |
| 28 | what does generate_token do | 738.97 | 226.27 | 3.27× |
| 29 | where is generate_token used | 808.7 | 213.12 | 3.79× |
| 30 | which functions are involved in authentication | 742.51 | 141.41 | 5.25× |
| 31 | what happens during login process | 611.52 | 167.36 | 3.65× |
| 32 | which functions are part of database interaction | 535.06 | 165.18 | 3.24× |
| 33 | what functions connect to the database | 605.4 | 161.72 | 3.74× |
| 34 | which functions are indirectly involved in connect_db | 429.08 | 169.45 | 2.53× |
| 35 | which function calls db_check | 444.95 | 166.49 | 2.67× |
| 36 | who calls db_check | 505.98 | 166.19 | 3.04× |
| 37 | which function calls validate_user | 462.37 | 159.56 | 2.9× |
| 38 | where is validate_user used | 400.29 | 188.01 | 2.13× |
| 39 | what does login do | 454.14 | 150.78 | 3.01× |
| 40 | show login flow | 467.69 | 150.87 | 3.1× |
| 41 | which functions are called by login | 544.93 | 191.71 | 2.84× |
| 42 | what does validate_user do | 408.48 | 165.72 | 2.46× |
| 43 | which functions are called by validate_user | 478.23 | 142.77 | 3.35× |
| 44 | what is the flow of validate_user | 383.41 | 162.02 | 2.37× |
| 45 | which function calls save_session | 455.72 | 168.7 | 2.7× |
| 46 | what does create_session do | 420.02 | 164.05 | 2.56× |
| 47 | which functions are called by create_session | 698.7 | 145.01 | 4.82× |
| 48 | which function calls log_attempt | 414.26 | 160.94 | 2.57× |
| 49 | what does db_check do | 455.91 | 250.87 | 1.82× |
| 50 | which function calls connect_db | 456.63 | 159.28 | 2.87× |
| 51 | who calls connect_db | 440.74 | 172.55 | 2.55× |
| 52 | where is db_check used | 482.93 | 152.89 | 3.16× |
| 53 | what is the flow of login | 407.92 | 182.41 | 2.24× |
| 54 | which functions are involved in login | 419.74 | 400.63 | 1.05× |
| 55 | how does login work | 500.56 | 184.37 | 2.72× |
| 56 | what does log_attempt do | 405.13 | 225.89 | 1.79× |
| 57 | which function calls create_session | 527.14 | 134.85 | 3.91× |
| 58 | how is session created | 604.8 | 156.79 | 3.86× |
| 59 | which functions are called inside create_session | 443.34 | 162.12 | 2.73× |
| 60 | what does save_session do | 415.56 | 145.7 | 2.85× |
| 61 | which function calls generate_token | 462.06 | 147.96 | 3.12× |
| 62 | what does generate_token do | 517.25 | 174.98 | 2.96× |
| 63 | where is generate_token used | 523.1 | 205.71 | 2.54× |
| 64 | which functions are involved in authentication | 361.26 | 171.87 | 2.1× |
| 65 | what happens during login process | 337.3 | 159.1 | 2.12× |
| 66 | which functions are part of database interaction | 429.62 | 185.42 | 2.32× |
| 67 | what functions connect to the database | 366.59 | 136.07 | 2.69× |
| 68 | which functions are indirectly involved in connect_db | 377.97 | 149.62 | 2.53× |
| 69 | which function calls db_check | 347.45 | 163.08 | 2.13× |
| 70 | who calls db_check | 370.89 | 135.17 | 2.74× |
| 71 | which function calls validate_user | 377.6 | 171.26 | 2.2× |
| 72 | where is validate_user used | 409.08 | 171.23 | 2.39× |
| 73 | what does login do | 398.75 | 291.6 | 1.37× |
| 74 | show login flow | 414.58 | 155.71 | 2.66× |
| 75 | which functions are called by login | 416.85 | 226.03 | 1.84× |
| 76 | what does validate_user do | 446.04 | 153.66 | 2.9× |
| 77 | which functions are called by validate_user | 467.6 | 180.14 | 2.6× |
| 78 | what is the flow of validate_user | 519.56 | 156.86 | 3.31× |
| 79 | which function calls save_session | 473.14 | 186.98 | 2.53× |
| 80 | what does create_session do | 450.17 | 160.99 | 2.8× |
| 81 | which functions are called by create_session | 511.41 | 205.78 | 2.49× |
| 82 | which function calls log_attempt | 403.78 | 172.47 | 2.34× |
| 83 | what does db_check do | 481.42 | 199.59 | 2.41× |
| 84 | which function calls connect_db | 511.37 | 179.91 | 2.84× |
| 85 | who calls connect_db | 435.56 | 179.72 | 2.42× |
| 86 | where is db_check used | 433.62 | 195.2 | 2.22× |
| 87 | what is the flow of login | 491.01 | 170.89 | 2.87× |
| 88 | which functions are involved in login | 426.33 | 187.58 | 2.27× |
| 89 | how does login work | 499.84 | 153.89 | 3.25× |
| 90 | what does log_attempt do | 512.45 | 226.17 | 2.27× |
| 91 | which function calls create_session | 505.08 | 187.53 | 2.69× |
| 92 | how is session created | 548.16 | 169.5 | 3.23× |
| 93 | which functions are called inside create_session | 587.45 | 177.07 | 3.32× |
| 94 | what does save_session do | 429.91 | 190.84 | 2.25× |
| 95 | which function calls generate_token | 481.21 | 155.94 | 3.09× |
| 96 | what does generate_token do | 440.65 | 203.37 | 2.17× |
| 97 | where is generate_token used | 427.4 | 457.85 | 0.93× |
| 98 | which functions are involved in authentication | 419.9 | 159.95 | 2.63× |
| 99 | what happens during login process | 460.35 | 178.63 | 2.58× |
| 100 | which functions are part of database interaction | 393.26 | 271.75 | 1.45× |

## Key Takeaways

- **p95 improvement**: 808.7 ms → 291.6 ms (**2.77× faster**)
- Embedding cache eliminates Gemini API RTT for repeated queries (50.0% hit rate)
- Search cache eliminates Qdrant round-trip for identical vectors (50.0% hit rate)

_Generated by `eval/benchmark_cache.py`_