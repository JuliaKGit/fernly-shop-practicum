# QA metrics

Routing accuracy 20/21 (95%). False-alarm rate 0/0.

| Pull request | Rows right | Rows reviewed | Minutes to plan | Minutes to QA report | Agent minutes | Findings | False alarms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [#1 Feature: Add promo codes](https://github.com/vskadorva/fernly-shop-practicum/pull/1) | 20 | 21 | 9 | — | 86 | 0 | 0 |
| [#6 Feature: Add back-in-stock badges and sign-up](https://github.com/vskadorva/fernly-shop-practicum/pull/6) | — | — | 37 | 2 | 66 | 0 | 0 |
| [#7 Feature: Add popular plants](https://github.com/vskadorva/fernly-shop-practicum/pull/7) | — | — | 11 | 2 | 52 | 0 | 0 |

## How each number is measured

These numbers are for every pull request labelled `plan-approved` in `vskadorva/fernly-shop-practicum`. The script only lists and reads with `gh`.

**Routing accuracy** is rows right divided by rows reviewed. Both come from the last comment by a person whose text starts with `Plan review: N/M`: N is rows right, M is rows reviewed. The totals add N and M across those pull requests. A bot comment does not count.

**Minutes to plan** is the time from opening the pull request to the first comment by `github-actions[bot]` that is not the QA report, rounded to the nearest minute.

**Minutes to QA report** is the time from opening the pull request to the first comment that contains `<!-- fernly-qa-report -->`, rounded to the nearest minute.

**Agent minutes** is the total time of the finished `pr-triage` runs for that pull request's branch. A run is finished when it completed with success, failure, or a timeout. Cancelled runs, and runs that stopped to wait for approval, are left out. Time runs from when the run started to when it finished, and the total is rounded to the nearest minute.

**Findings** are issues labelled `qa-finding` whose body links to the pull request (`/pull/<number>`). **False alarms** are those findings closed as not planned. The false-alarm rate is false alarms divided by findings.

**Money** is not in GitHub. Agent spend is on the [Cursor dashboard](https://cursor.com/dashboard).

Regenerate this file with `node scripts/qa-metrics.mjs`.
