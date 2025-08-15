# Changelog

## 0.13.4 (2025-08-15)

Full Changelog: [v0.13.3...v0.13.4](https://github.com/openlayer-ai/openlayer-ts/compare/v0.13.3...v0.13.4)

### Bug Fixes

* log AWS error in Bedrock tracer ([40ca31b](https://github.com/openlayer-ai/openlayer-ts/commit/40ca31bae81c848df7444bf61c82c1bbf7e943ec))

## 0.13.3 (2025-08-15)

Full Changelog: [v0.13.2...v0.13.3](https://github.com/openlayer-ai/openlayer-ts/compare/v0.13.2...v0.13.3)

### Chores

* add debug statements to trace upload ([103098b](https://github.com/openlayer-ai/openlayer-ts/commit/103098b25f8f89eb32d01d08b7b651b9ca306498))
* **internal:** update comment in script ([5aff731](https://github.com/openlayer-ai/openlayer-ts/commit/5aff731c4fc3e027a67348d0a042088cd7144b50))
* update @stainless-api/prism-cli to v5.15.0 ([b396a4c](https://github.com/openlayer-ai/openlayer-ts/commit/b396a4cb94a5ec0b303aff0944a243a8704e95ca))

## 0.13.2 (2025-08-07)

Full Changelog: [v0.13.1...v0.13.2](https://github.com/openlayer-ai/openlayer-ts/compare/v0.13.1...v0.13.2)

### Features

* add Bedrock agent tracer ([82cecbf](https://github.com/openlayer-ai/openlayer-ts/commit/82cecbf9d6445b3d728c2ab60d2d8416da867b07))


### Bug Fixes

* conditional Bedrock import ([a745e01](https://github.com/openlayer-ai/openlayer-ts/commit/a745e013920c88a30472e8f2eda0dc66699c04b5))


### Chores

* **internal:** move publish config ([67a5488](https://github.com/openlayer-ai/openlayer-ts/commit/67a5488bff6880aff2fd14840fbfd24212aa74bd))
* **internal:** remove redundant imports config ([52d519a](https://github.com/openlayer-ai/openlayer-ts/commit/52d519aca9b9cfe2bf254191a47932a4e62545d6))

## 0.13.1 (2025-07-10)

Full Changelog: [v0.13.0...v0.13.1](https://github.com/openlayer-ai/openlayer-ts/compare/v0.13.0...v0.13.1)

### Chores

* clean up whitespace in langgraph-openlayer.ts ([2f1590e](https://github.com/openlayer-ai/openlayer-ts/commit/2f1590e0b2ea37f5ab02731a715a0051c7a8da0a))
* **internal:** version bump ([64a8e5c](https://github.com/openlayer-ai/openlayer-ts/commit/64a8e5ce86d01f0b620cb5c423eb710c428da726))

## 0.13.0 (2025-07-09)

Full Changelog: [v0.12.0...v0.13.0](https://github.com/openlayer-ai/openlayer-ts/compare/v0.12.0...v0.13.0)

### Features

* **api:** add test creation endpoint ([b5ca558](https://github.com/openlayer-ai/openlayer-ts/commit/b5ca558bd715a2f2a2b4e463c71b8ee74f689fb7))
* **api:** api update ([c08bc30](https://github.com/openlayer-ai/openlayer-ts/commit/c08bc302d61a2d2dace0348c43fb2a2d9d5e3b43))
* **api:** api update ([21bf624](https://github.com/openlayer-ai/openlayer-ts/commit/21bf624b29037dec3a0daeda1c578f829da341a3))
* **api:** api update ([4a2f9f8](https://github.com/openlayer-ai/openlayer-ts/commit/4a2f9f8e180e63e258752de9835697df541c548b))
* **api:** api update ([631a79a](https://github.com/openlayer-ai/openlayer-ts/commit/631a79a91c55b7f8917e40f952faead29aae3d17))
* **api:** api update ([b94c7b1](https://github.com/openlayer-ai/openlayer-ts/commit/b94c7b1219ca99ffa26a725c5bca8ca1e11eed64))
* **api:** api update ([a133305](https://github.com/openlayer-ai/openlayer-ts/commit/a13330509527d784b7f7ca0b1cfc0e16be083ad8))
* **api:** expose test retrieval endpoint ([8fff7c0](https://github.com/openlayer-ai/openlayer-ts/commit/8fff7c08aef44c5d3a606a5c516b42e422b9bf4a))
* **api:** expose test retrieval endpoint ([44db29b](https://github.com/openlayer-ai/openlayer-ts/commit/44db29b20db663aa7751d5bd1b6b9db0ea71a0c5))
* **api:** expose test update endpoint ([7e129a6](https://github.com/openlayer-ai/openlayer-ts/commit/7e129a67b8a1377119928efee912b95cb2c1b1f6))
* **client:** add support for endpoint-specific base URLs ([2905588](https://github.com/openlayer-ai/openlayer-ts/commit/2905588b52a3a82b8a2cc6500bef798addd07ba3))
* **client:** send `X-Stainless-Timeout` header ([7019c85](https://github.com/openlayer-ai/openlayer-ts/commit/7019c85f937de8dae8a250d9d10f62fe426b6723))


### Bug Fixes

* **api:** improve type resolution when importing as a package ([#119](https://github.com/openlayer-ai/openlayer-ts/issues/119)) ([a758e18](https://github.com/openlayer-ai/openlayer-ts/commit/a758e18aa98963fdbaf606adccb47d8f13b93a7a))
* avoid type error in certain environments ([#115](https://github.com/openlayer-ai/openlayer-ts/issues/115)) ([f7448d9](https://github.com/openlayer-ai/openlayer-ts/commit/f7448d9f2a2280e2342ff94e7bff8ac6576d517d))
* **ci:** release-doctor — report correct token name ([e5e5f3b](https://github.com/openlayer-ai/openlayer-ts/commit/e5e5f3b29f0ec33fd4827a48871e3d1a2537c87e))
* **client:** don't send `Content-Type` for bodyless methods ([ffd0619](https://github.com/openlayer-ai/openlayer-ts/commit/ffd0619398f693322297d7b4e6eec1f864754133))
* **client:** fix export map for index exports ([3cef27b](https://github.com/openlayer-ai/openlayer-ts/commit/3cef27ba29799388aca98765a42d1b27217ce944))
* **client:** send `X-Stainless-Timeout` in seconds ([#117](https://github.com/openlayer-ai/openlayer-ts/issues/117)) ([8349fbc](https://github.com/openlayer-ai/openlayer-ts/commit/8349fbc8c942fbedf433ed6babea1ef4ce896ce7))
* **imports:** update import paths for OpenlayerHandler and traceOpenAI to reflect new module structure ([e57d2be](https://github.com/openlayer-ai/openlayer-ts/commit/e57d2be6b97d29f58baa6374af1cbbb7e85125dc))
* **internal:** work around https://github.com/vercel/next.js/issues/76881 ([#116](https://github.com/openlayer-ai/openlayer-ts/issues/116)) ([3d750a5](https://github.com/openlayer-ai/openlayer-ts/commit/3d750a52a5a2fc211a1936657b822ad0646e7e7f))
* **mcp:** remove unused tools.ts ([#120](https://github.com/openlayer-ai/openlayer-ts/issues/120)) ([d00061f](https://github.com/openlayer-ai/openlayer-ts/commit/d00061f9bdf4a7e82d12d79a7a43c9abe6f01bc9))
* publish script — handle NPM errors correctly ([33f3a0d](https://github.com/openlayer-ai/openlayer-ts/commit/33f3a0d85bbfdc6f3e6f30244722e56bdd4e316c))


### Chores

* **ci:** add timeout thresholds for CI jobs ([fcfa14a](https://github.com/openlayer-ai/openlayer-ts/commit/fcfa14a94bd05fc0e318179e5a6f98478a316a8a))
* **ci:** bump node version for release workflows ([82ed245](https://github.com/openlayer-ai/openlayer-ts/commit/82ed245e7f356748adda6d2c0c3ca86a31b29cf1))
* **ci:** enable for pull requests ([0f02451](https://github.com/openlayer-ai/openlayer-ts/commit/0f02451999a6249b05eb07f862f8da8564928379))
* **ci:** only run for pushes and fork pull requests ([60a3cd5](https://github.com/openlayer-ai/openlayer-ts/commit/60a3cd57bc3d1e3fb5fc4e0b76dd215b93df96a3))
* **ci:** only use depot for staging repos ([e1cb08a](https://github.com/openlayer-ai/openlayer-ts/commit/e1cb08a3900378b3a2d7e240b657e3a3ee862cee))
* **client:** minor internal fixes ([8d1e577](https://github.com/openlayer-ai/openlayer-ts/commit/8d1e577c7bd97da21d58a2cb5ee4ee9ac2457f04))
* **docs:** grammar improvements ([764521c](https://github.com/openlayer-ai/openlayer-ts/commit/764521c36e2b24319ba92d4d9e569ad8894f4ad3))
* **docs:** use top-level-await in example snippets ([9a627db](https://github.com/openlayer-ai/openlayer-ts/commit/9a627dbdaddb88a83f141c9c25327b977ae2056a))
* **exports:** cleaner resource index imports ([#113](https://github.com/openlayer-ai/openlayer-ts/issues/113)) ([1647ab7](https://github.com/openlayer-ai/openlayer-ts/commit/1647ab7d2bbb81d81f923f31c0c72a570e4014c8))
* **exports:** stop using path fallbacks ([#114](https://github.com/openlayer-ai/openlayer-ts/issues/114)) ([39719a5](https://github.com/openlayer-ai/openlayer-ts/commit/39719a5b29432c9a9bb6a168356064019b35250d))
* improve publish-npm script --latest tag logic ([0292843](https://github.com/openlayer-ai/openlayer-ts/commit/029284308d98b5f42460444906d60d8c10fda9eb))
* **internal:** add aliases for Record and Array ([#118](https://github.com/openlayer-ai/openlayer-ts/issues/118)) ([6fdf6fa](https://github.com/openlayer-ai/openlayer-ts/commit/6fdf6fa73e56d0be5a37533c2c416438c38d33fa))
* **internal:** codegen related update ([5d338c6](https://github.com/openlayer-ai/openlayer-ts/commit/5d338c6b15812037d2d18a3751cd3bc7ab41daf8))
* **internal:** codegen related update ([2b134e4](https://github.com/openlayer-ai/openlayer-ts/commit/2b134e4095619b18e60b5fcb1312698fdb2c7e88))
* **internal:** codegen related update ([628f5e0](https://github.com/openlayer-ai/openlayer-ts/commit/628f5e00e0c9efdd86cd7af639dfc5ede530fa20))
* **internal:** codegen related update ([90f7b7c](https://github.com/openlayer-ai/openlayer-ts/commit/90f7b7ca08e4beac2c56215dfe25a58c27d55619))
* **internal:** codegen related update ([f278cf3](https://github.com/openlayer-ai/openlayer-ts/commit/f278cf329287d9a95e1e95e38fa7dfd4a31c4476))
* **internal:** codegen related update ([9e02f0b](https://github.com/openlayer-ai/openlayer-ts/commit/9e02f0b737f9f81ef4f845b79f54190fa2d3470a))
* **internal:** fix devcontainers setup ([163b07d](https://github.com/openlayer-ai/openlayer-ts/commit/163b07d2bec534cd44326bffa028e6c1d627d3d7))
* **internal:** fix workflows ([3e53c94](https://github.com/openlayer-ai/openlayer-ts/commit/3e53c94cd883482a06ad0eb8268900c872c8d65f))
* **internal:** make base APIResource abstract ([667b403](https://github.com/openlayer-ai/openlayer-ts/commit/667b403659d18700e89bba1875e7fe58baa6f2a2))
* **internal:** reduce CI branch coverage ([0cb981b](https://github.com/openlayer-ai/openlayer-ts/commit/0cb981bf6ce8d6ea19dc92c435517acf0daa55b2))
* **internal:** upload builds and expand CI branch coverage ([9e492b1](https://github.com/openlayer-ai/openlayer-ts/commit/9e492b1ca40b5b7ca46e9f1b0b793572716af1aa))
* **internal:** version bump ([989e4c6](https://github.com/openlayer-ai/openlayer-ts/commit/989e4c6179d46b06159ed534663032d8fd29bb65))
* **internal:** version bump ([52cc09a](https://github.com/openlayer-ai/openlayer-ts/commit/52cc09a6663124e4c48353e7f1b651f2760e766a))
* mention unit type in timeout docs ([55fb773](https://github.com/openlayer-ai/openlayer-ts/commit/55fb7733bf0858555f628c2300f4ea71287f3de5))
* **tests:** improve enum examples ([#121](https://github.com/openlayer-ai/openlayer-ts/issues/121)) ([78996ac](https://github.com/openlayer-ai/openlayer-ts/commit/78996acba5907a6a2deccf334bc9089a96e8b978))


### Documentation

* add examples to tsdocs ([d3b8142](https://github.com/openlayer-ai/openlayer-ts/commit/d3b81423a7c10f51b6a213da42e596f8f8ff699c))
* **readme:** fix typo ([274cc42](https://github.com/openlayer-ai/openlayer-ts/commit/274cc42054d2eced24475304724ee191a72a06dd))
* update URLs from stainlessapi.com to stainless.com ([6c1c6f3](https://github.com/openlayer-ai/openlayer-ts/commit/6c1c6f3de4b9093725a31fa273c9de256ddc3db8))


### Refactors

* **types:** replace Record with mapped types ([8837a96](https://github.com/openlayer-ai/openlayer-ts/commit/8837a966afbc24a8f6455833e3bdb2553ed58ad1))

## 0.12.0 (2025-03-14)

Full Changelog: [v0.11.0...v0.12.0](https://github.com/openlayer-ai/openlayer-ts/compare/v0.11.0...v0.12.0)

### Features

* **client:** accept RFC6838 JSON content types ([#108](https://github.com/openlayer-ai/openlayer-ts/issues/108)) ([f7acf0d](https://github.com/openlayer-ai/openlayer-ts/commit/f7acf0d19bf08c2ea2286461b99511535ba49b3a))


### Bug Fixes

* **exports:** ensure resource imports don't require /index ([#110](https://github.com/openlayer-ai/openlayer-ts/issues/110)) ([2c80460](https://github.com/openlayer-ai/openlayer-ts/commit/2c804607bc5135c0b5170c6d98e4439b429a6e43))


### Chores

* **internal:** codegen related update ([#106](https://github.com/openlayer-ai/openlayer-ts/issues/106)) ([7089dd9](https://github.com/openlayer-ai/openlayer-ts/commit/7089dd97d1a74d6e2d67e360b7b2db2799aaf98f))
* **internal:** remove extra empty newlines ([#109](https://github.com/openlayer-ai/openlayer-ts/issues/109)) ([bd6512c](https://github.com/openlayer-ai/openlayer-ts/commit/bd6512c00ee8d1cf2c623ad1de26f56a6c158629))

## 0.11.0 (2025-03-13)

Full Changelog: [v0.10.3...v0.11.0](https://github.com/openlayer-ai/openlayer-ts/compare/v0.10.3...v0.11.0)

### Features

* **api:** add endpoint to retrieve commit by id ([#103](https://github.com/openlayer-ai/openlayer-ts/issues/103)) ([5247899](https://github.com/openlayer-ai/openlayer-ts/commit/52478996d3008109c42e9b4f0e11c206717474ac))

## 0.10.3 (2025-01-01)

Full Changelog: [v0.10.2...v0.10.3](https://github.com/openlayer-ai/openlayer-ts/compare/v0.10.2...v0.10.3)

### Chores

* **internal:** version bump ([#101](https://github.com/openlayer-ai/openlayer-ts/issues/101)) ([5d4e0ad](https://github.com/openlayer-ai/openlayer-ts/commit/5d4e0ad5a119b8c81b62b8dd918082bcd00dabc8))

## 0.10.2 (2024-12-21)

Full Changelog: [v0.10.1...v0.10.2](https://github.com/openlayer-ai/openlayer-ts/compare/v0.10.1...v0.10.2)

### Chores

* **internal:** codegen related update ([#97](https://github.com/openlayer-ai/openlayer-ts/issues/97)) ([6ff949f](https://github.com/openlayer-ai/openlayer-ts/commit/6ff949f3a13376f97f1449669e608594917bfeff))
* **internal:** codegen related update ([#99](https://github.com/openlayer-ai/openlayer-ts/issues/99)) ([12ce253](https://github.com/openlayer-ai/openlayer-ts/commit/12ce253819091fbba1ea860cca7b75ada7ae0711))


### Documentation

* minor formatting changes ([#100](https://github.com/openlayer-ai/openlayer-ts/issues/100)) ([44b41e7](https://github.com/openlayer-ai/openlayer-ts/commit/44b41e7f7e7bd292dacd7a35090c2d5b5c7119a1))

## 0.10.1 (2024-12-20)

Full Changelog: [v0.10.0...v0.10.1](https://github.com/openlayer-ai/openlayer-ts/compare/v0.10.0...v0.10.1)

### Chores

* **internal:** codegen related update ([#94](https://github.com/openlayer-ai/openlayer-ts/issues/94)) ([2b62732](https://github.com/openlayer-ai/openlayer-ts/commit/2b62732d4414f72715911e07d017b0297b1e896c))

## 0.10.0 (2024-12-18)

Full Changelog: [v0.9.4...v0.10.0](https://github.com/openlayer-ai/openlayer-ts/compare/v0.9.4...v0.10.0)

### Features

* **api:** api update ([#90](https://github.com/openlayer-ai/openlayer-ts/issues/90)) ([b7a05da](https://github.com/openlayer-ai/openlayer-ts/commit/b7a05daa95090c6ee9a286260d8b2d5c2871ae4d))


### Chores

* **internal:** fix some typos ([#92](https://github.com/openlayer-ai/openlayer-ts/issues/92)) ([03de89d](https://github.com/openlayer-ai/openlayer-ts/commit/03de89dfbd6eeb436eb6025eb5c433b523fa9aab))

## 0.9.4 (2024-12-12)

Full Changelog: [v0.9.3...v0.9.4](https://github.com/openlayer-ai/openlayer-ts/compare/v0.9.3...v0.9.4)

### Chores

* **internal:** update isAbsoluteURL ([#87](https://github.com/openlayer-ai/openlayer-ts/issues/87)) ([57c400a](https://github.com/openlayer-ai/openlayer-ts/commit/57c400a349286c545265ceb3c3b4961634895d5c))

## 0.9.3 (2024-12-11)

Full Changelog: [v0.9.2...v0.9.3](https://github.com/openlayer-ai/openlayer-ts/compare/v0.9.2...v0.9.3)

### Chores

* **types:** nicer error class types + jsdocs ([#84](https://github.com/openlayer-ai/openlayer-ts/issues/84)) ([f0b48a0](https://github.com/openlayer-ai/openlayer-ts/commit/f0b48a016657d7b8b1b2b0d70a5dba89b7673ed2))

## 0.9.2 (2024-12-10)

Full Changelog: [v0.9.1...v0.9.2](https://github.com/openlayer-ai/openlayer-ts/compare/v0.9.1...v0.9.2)

### Chores

* **internal:** bump cross-spawn to v7.0.6 ([#81](https://github.com/openlayer-ai/openlayer-ts/issues/81)) ([982fd51](https://github.com/openlayer-ai/openlayer-ts/commit/982fd51f6dcf50a5ee59b45cf59ccf5ed477802e))
* **internal:** remove unnecessary getRequestClient function ([#79](https://github.com/openlayer-ai/openlayer-ts/issues/79)) ([dd6b4b9](https://github.com/openlayer-ai/openlayer-ts/commit/dd6b4b9c2534f1e01ff76917648b5946a5b8b0ab))

## 0.9.1 (2024-12-05)

Full Changelog: [v0.9.0...v0.9.1](https://github.com/openlayer-ai/openlayer-ts/compare/v0.9.0...v0.9.1)

### Chores

* bump ([d43716a](https://github.com/openlayer-ai/openlayer-ts/commit/d43716a3324548fb71f031e17b221ebca9df55c9))

## 0.9.0 (2024-11-28)

Full Changelog: [v0.8.0...v0.9.0](https://github.com/openlayer-ai/openlayer-ts/compare/v0.8.0...v0.9.0)

### Features

* **internal:** make git install file structure match npm ([#74](https://github.com/openlayer-ai/openlayer-ts/issues/74)) ([654e649](https://github.com/openlayer-ai/openlayer-ts/commit/654e649c654eb97cf57ec8eb1f3a923f5547085c))


### Chores

* bump ([070fae4](https://github.com/openlayer-ai/openlayer-ts/commit/070fae440bdde8caeda25552c2f206821aab2b84))

## 0.8.0 (2024-11-21)

Full Changelog: [v0.7.0...v0.8.0](https://github.com/openlayer-ai/openlayer-ts/compare/v0.7.0...v0.8.0)

### Features

* **api:** manual updates ([#57](https://github.com/openlayer-ai/openlayer-ts/issues/57)) ([d6932b7](https://github.com/openlayer-ai/openlayer-ts/commit/d6932b7e78b38b774ba26b45060523ec40e5fae8))
* **api:** OpenAPI spec update via Stainless API ([#49](https://github.com/openlayer-ai/openlayer-ts/issues/49)) ([98ccfe0](https://github.com/openlayer-ai/openlayer-ts/commit/98ccfe09d2f797daf2d630ae179c82531fa2bc63))
* **api:** update via SDK Studio ([#45](https://github.com/openlayer-ai/openlayer-ts/issues/45)) ([fc02cc7](https://github.com/openlayer-ai/openlayer-ts/commit/fc02cc7f1cd4bcb0db72f32d8042524b30bd4db8))
* **api:** update via SDK Studio ([#47](https://github.com/openlayer-ai/openlayer-ts/issues/47)) ([5915bbb](https://github.com/openlayer-ai/openlayer-ts/commit/5915bbbc9011e02fc616e5fb849bb91e71dc1350))
* **api:** update via SDK Studio ([#54](https://github.com/openlayer-ai/openlayer-ts/issues/54)) ([839a44f](https://github.com/openlayer-ai/openlayer-ts/commit/839a44ff54aac9ef1fe060e0c5995944edebea05))
* **api:** update via SDK Studio ([#56](https://github.com/openlayer-ai/openlayer-ts/issues/56)) ([cc41f60](https://github.com/openlayer-ai/openlayer-ts/commit/cc41f60814764f8f2a344cb685c9ca0a2fe1a977))


### Bug Fixes

* **dependencies:** update braces in yarn.lock files ([114b9e5](https://github.com/openlayer-ai/openlayer-ts/commit/114b9e5a4e7bc65dab32e0ddae5e22848f4e9211))
* **example:** upgrade packages and lock files ([7e9b3f1](https://github.com/openlayer-ai/openlayer-ts/commit/7e9b3f1379e870b1f04f6cbb52516bd54466ee9e))
* remove openai/src import ([55dc02e](https://github.com/openlayer-ai/openlayer-ts/commit/55dc02e7ff17ec6945eca7dcff34396caca0ab64))
* remove package-lock.json ([027a604](https://github.com/openlayer-ai/openlayer-ts/commit/027a60418a215c9b74732d13437fa5f0124d27b8))


### Chores

* bump ([94becdb](https://github.com/openlayer-ai/openlayer-ts/commit/94becdbac782934b42ed59570fa3f10f77a43e82))
* **ci:** bump prism mock server version ([#43](https://github.com/openlayer-ai/openlayer-ts/issues/43)) ([3fc5656](https://github.com/openlayer-ai/openlayer-ts/commit/3fc5656d8794fb279dbe81b754c496591c405cc8))
* custom code changes ([#58](https://github.com/openlayer-ai/openlayer-ts/issues/58)) ([0e955e4](https://github.com/openlayer-ai/openlayer-ts/commit/0e955e4752b7c64795dc7e27200efe1d1c5ec24e))
* **deps:** bump braces from 3.0.2 to 3.0.3 ([587df74](https://github.com/openlayer-ai/openlayer-ts/commit/587df74a65f4a7ae0d2043250672d80522533a38))
* **examples:** minor formatting changes ([#44](https://github.com/openlayer-ai/openlayer-ts/issues/44)) ([ba2c05a](https://github.com/openlayer-ai/openlayer-ts/commit/ba2c05a1efe47963ef2bee9d23280d21c5f737f6))
* **internal:** codegen related update ([#41](https://github.com/openlayer-ai/openlayer-ts/issues/41)) ([af72fc9](https://github.com/openlayer-ai/openlayer-ts/commit/af72fc915944de479aa1ff30d2ebe5870e1cf01c))
* **internal:** minor fixes ([5e744b7](https://github.com/openlayer-ai/openlayer-ts/commit/5e744b743c64bc028eb21fe7ed13fef61af8600f))
* rebuild project due to codegen change ([#59](https://github.com/openlayer-ai/openlayer-ts/issues/59)) ([6d230c2](https://github.com/openlayer-ai/openlayer-ts/commit/6d230c21626c8cc251892d7b9ab7265a58a8c002))
* rebuild project due to codegen change ([#60](https://github.com/openlayer-ai/openlayer-ts/issues/60)) ([d9eb428](https://github.com/openlayer-ai/openlayer-ts/commit/d9eb428f1e9fb65c384df66e086a0975505b38a7))
* rebuild project due to codegen change ([#65](https://github.com/openlayer-ai/openlayer-ts/issues/65)) ([f11fe41](https://github.com/openlayer-ai/openlayer-ts/commit/f11fe414fd9b87e1c92905d2e0047f30030ace23))
* rebuild project due to codegen change ([#67](https://github.com/openlayer-ai/openlayer-ts/issues/67)) ([4f14919](https://github.com/openlayer-ai/openlayer-ts/commit/4f14919a4300642b41b904e71939a9c4678d1904))
* remove redundant word in comment ([#69](https://github.com/openlayer-ai/openlayer-ts/issues/69)) ([4157f4b](https://github.com/openlayer-ai/openlayer-ts/commit/4157f4b096a39f024cca2669c2ccf54177631c0f))
* update yarn lockfile ([82a6b22](https://github.com/openlayer-ai/openlayer-ts/commit/82a6b222f7f1603f2faa04afc66133ea181915ae))


### Documentation

* remove suggestion to use `npm` call out ([#68](https://github.com/openlayer-ai/openlayer-ts/issues/68)) ([949ab79](https://github.com/openlayer-ai/openlayer-ts/commit/949ab7922bdea71ae302c68021ef26ad569f7b80))

## 0.7.0 (2024-09-24)

Full Changelog: [v0.6.0...v0.7.0](https://github.com/openlayer-ai/openlayer-ts/compare/v0.6.0...v0.7.0)

### Features

* fix: add @langchain/core to dependencies ([1deded1](https://github.com/openlayer-ai/openlayer-ts/commit/1deded1f64c1ef5b0ab702a94fd1fb2809007bad))

## 0.6.0 (2024-09-24)

Full Changelog: [v0.5.0...v0.6.0](https://github.com/openlayer-ai/openlayer-ts/compare/v0.5.0...v0.6.0)

### Features

* feat: introduce the OpenlayerHandler, which implements the LangChain callback handler interface ([865978e](https://github.com/openlayer-ai/openlayer-ts/commit/865978e4f0d64c3106574ec3cf3ad13198d23e9e))

## 0.5.0 (2024-08-14)

Full Changelog: [v0.4.0...v0.5.0](https://github.com/openlayer-ai/openlayer-ts/compare/v0.4.0...v0.5.0)

### Features

* **api:** OpenAPI spec update via Stainless API ([#32](https://github.com/openlayer-ai/openlayer-ts/issues/32)) ([4093a32](https://github.com/openlayer-ai/openlayer-ts/commit/4093a322951a8aee5587e157de04a74b7fa742d8))
* **api:** update via SDK Studio ([#37](https://github.com/openlayer-ai/openlayer-ts/issues/37)) ([d4677ae](https://github.com/openlayer-ai/openlayer-ts/commit/d4677aec42685f76709adfe54ce338f929a6ab95))
* **api:** update via SDK Studio ([#38](https://github.com/openlayer-ai/openlayer-ts/issues/38)) ([0aca490](https://github.com/openlayer-ai/openlayer-ts/commit/0aca4901862aa8dba0baa7c19efca802b46ccc6c))
* **api:** update via SDK Studio ([#40](https://github.com/openlayer-ai/openlayer-ts/issues/40)) ([7aee058](https://github.com/openlayer-ai/openlayer-ts/commit/7aee058a11a665c40052265f90d81985cb012668))


### Chores

* **ci:** limit release doctor target branches ([#35](https://github.com/openlayer-ai/openlayer-ts/issues/35)) ([7c856f8](https://github.com/openlayer-ai/openlayer-ts/commit/7c856f834d10fa4d86498d2d29f9df728ce3d1c7))
* **docs:** use client instead of package name in Node examples ([#34](https://github.com/openlayer-ai/openlayer-ts/issues/34)) ([887d2e2](https://github.com/openlayer-ai/openlayer-ts/commit/887d2e264fd099de54922d97fb4d7be244baa0bc))
* **internal:** codegen related update ([#36](https://github.com/openlayer-ai/openlayer-ts/issues/36)) ([f5fed5c](https://github.com/openlayer-ai/openlayer-ts/commit/f5fed5ce250d99337481d5fb1310734e8fa22700))
* **tests:** update prism version ([#39](https://github.com/openlayer-ai/openlayer-ts/issues/39)) ([34694e3](https://github.com/openlayer-ai/openlayer-ts/commit/34694e33939e786cb5a3c086ce5a8e023472a023))

## 0.4.0 (2024-07-17)

Full Changelog: [v0.3.0...v0.4.0](https://github.com/openlayer-ai/openlayer-ts/compare/v0.3.0...v0.4.0)

### Features

* **api:** OpenAPI spec update via Stainless API ([#27](https://github.com/openlayer-ai/openlayer-ts/issues/27)) ([8e1b3c7](https://github.com/openlayer-ai/openlayer-ts/commit/8e1b3c7c31113596ef4ef2539f49b824f2b93cff))
* **api:** update via SDK Studio ([#29](https://github.com/openlayer-ai/openlayer-ts/issues/29)) ([1e7eed5](https://github.com/openlayer-ai/openlayer-ts/commit/1e7eed5acb7fe5ae931c5b0238eda0512fbd46b8))
* **api:** update via SDK Studio ([#30](https://github.com/openlayer-ai/openlayer-ts/issues/30)) ([742ef6a](https://github.com/openlayer-ai/openlayer-ts/commit/742ef6ae37fedae5640a829fa149b947c8d362b5))

## 0.3.0 (2024-07-08)

Full Changelog: [v0.2.2...v0.3.0](https://github.com/openlayer-ai/openlayer-ts/compare/v0.2.2...v0.3.0)

### Features

* **api:** OpenAPI spec update via Stainless API ([#23](https://github.com/openlayer-ai/openlayer-ts/issues/23)) ([5b4cd52](https://github.com/openlayer-ai/openlayer-ts/commit/5b4cd5246aed3ff1168fde683e56f53b4d4f5300))
* **api:** OpenAPI spec update via Stainless API ([#24](https://github.com/openlayer-ai/openlayer-ts/issues/24)) ([66aedcb](https://github.com/openlayer-ai/openlayer-ts/commit/66aedcbcfa5a7684602da7b68cf680d48c337a95))
* **api:** update via SDK Studio ([#20](https://github.com/openlayer-ai/openlayer-ts/issues/20)) ([2db48ab](https://github.com/openlayer-ai/openlayer-ts/commit/2db48ab38bead726c68039f679bd0fd601588ad9))
* **api:** update via SDK Studio ([#25](https://github.com/openlayer-ai/openlayer-ts/issues/25)) ([b673070](https://github.com/openlayer-ai/openlayer-ts/commit/b6730709975f7f965e47d9cbff2ad18e01afe768))


### Chores

* go live ([#26](https://github.com/openlayer-ai/openlayer-ts/issues/26)) ([c8f17b6](https://github.com/openlayer-ai/openlayer-ts/commit/c8f17b649a5f2d3d134390d81c357f5e80bda83e))

## 0.2.2 (2024-07-05)

Full Changelog: [v0.2.1...v0.2.2](https://github.com/openlayer-ai/openlayer-ts/compare/v0.2.1...v0.2.2)

### Features

* **api:** update via SDK Studio ([#16](https://github.com/openlayer-ai/openlayer-ts/issues/16)) ([699ba47](https://github.com/openlayer-ai/openlayer-ts/commit/699ba477252cac4546237afd55f5375171fff381))


### Chores

* go live ([#18](https://github.com/openlayer-ai/openlayer-ts/issues/18)) ([fadc413](https://github.com/openlayer-ai/openlayer-ts/commit/fadc41325e5427f4b0d43281407b5f57f72f7854))
* update SDK settings ([#19](https://github.com/openlayer-ai/openlayer-ts/issues/19)) ([862666d](https://github.com/openlayer-ai/openlayer-ts/commit/862666da0c19f2cdb373be7aa89660c1fab9df8f))

## 0.2.1 (2024-06-10)

Full Changelog: [v0.2.0...v0.2.1](https://github.com/openlayer-ai/openlayer-ts/compare/v0.2.0...v0.2.1)

### Chores

* **internal:** version bump ([#13](https://github.com/openlayer-ai/openlayer-ts/issues/13)) ([f0dbf8b](https://github.com/openlayer-ai/openlayer-ts/commit/f0dbf8b19ec08829b1a68053cff0e7ea6c139a75))

## 0.2.0 (2024-06-10)

Full Changelog: [v0.1.45...v0.2.0](https://github.com/openlayer-ai/openlayer-ts/compare/v0.1.45...v0.2.0)

### Features

* add cost estimate and ability to log arbitrary columns ([2137e80](https://github.com/openlayer-ai/openlayer-ts/commit/2137e80b6d1d01b617bf2c49cfe244344d6a16bf))
* add support for the assistants api ([abc667c](https://github.com/openlayer-ai/openlayer-ts/commit/abc667c2c74f4d19894ab90a4e4469e37f7fb782))
* enable using Openlayer in JS with alternative providers ([5a635a1](https://github.com/openlayer-ai/openlayer-ts/commit/5a635a118473427922e638a091e49d940992e512))
* move project and inference pipeline setup to startMonitoring method ([26db616](https://github.com/openlayer-ai/openlayer-ts/commit/26db616560b2c4b3d8d6dee809cbfff08e672d63))
* support for new development workflow ([c4034ce](https://github.com/openlayer-ai/openlayer-ts/commit/c4034ce6e1666732a6eed4e847428bab34fc914e))
* various codegen changes ([4ec0b86](https://github.com/openlayer-ai/openlayer-ts/commit/4ec0b861ee0fecd8b6cd42c2341b5959417a285e))


### Bug Fixes

* calculate tokens in streaming completions ([b7343ca](https://github.com/openlayer-ai/openlayer-ts/commit/b7343cae6d6d87fc32147df135efd942521c5839))
* entry point does not resolve with submodules ([184f877](https://github.com/openlayer-ai/openlayer-ts/commit/184f877cc9d01db8b98321185c96bcf4714bbe2c))
* extraneous warning logs when inference pipeline not located for monitoring assistant runs ([8b81e70](https://github.com/openlayer-ai/openlayer-ts/commit/8b81e70af0eee4037375343b814279d79567c507))
* incorrect symbol in LangChain example ([865abf8](https://github.com/openlayer-ai/openlayer-ts/commit/865abf88e8231645b2d92be8e8a48a6a08bb7462))
* ReferenceError when using fetch ([017df18](https://github.com/openlayer-ai/openlayer-ts/commit/017df189ab92ec71d96352a8970203dbc41f7ac7))
* rename token count column ([66a0b46](https://github.com/openlayer-ai/openlayer-ts/commit/66a0b46cc1fe0a849307ac54516b749bc6f60e63))
* rm version from data-stream queries ([8f418ec](https://github.com/openlayer-ai/openlayer-ts/commit/8f418ec9508a9291f513e6c714c8be57c2b9dc5f))
* round timestamp seconds to nearest int ([01d442e](https://github.com/openlayer-ai/openlayer-ts/commit/01d442e239f7df51f6f638cc009e9ad1273a4619))
* update config to adopt new prompt tracking schema ([5a813c3](https://github.com/openlayer-ai/openlayer-ts/commit/5a813c3bd774c10b43beb87498f74f8430d44ace))
* update examples to fix race condition issue when processing multiple requests back-to-back ([6e9f9f8](https://github.com/openlayer-ai/openlayer-ts/commit/6e9f9f81c1557199a9c43bec6d60a69f34c9ecbc))


### Chores

* add example module for using Openlayer with LangChain ([3860579](https://github.com/openlayer-ai/openlayer-ts/commit/3860579ce0edeb5daebf99cb96432235fb52ba9a))
* add new turbo model pricings ([f6ef841](https://github.com/openlayer-ai/openlayer-ts/commit/f6ef841ce8ee4ed9bb1a9001a815efeeaa53e8ac))
* add README ([cd94cee](https://github.com/openlayer-ai/openlayer-ts/commit/cd94cee3564d139a14594143e1698865366806b0))
* adopt new schema for managing prompts ([160b3a5](https://github.com/openlayer-ai/openlayer-ts/commit/160b3a5e6a177af1d5066def2dfe1c243c2ba9de))
* downgrade node-fetch ([b73f237](https://github.com/openlayer-ai/openlayer-ts/commit/b73f2379a97551b4bae4a488fd4865c37ef5f41d))
* increment npm version ([62d890d](https://github.com/openlayer-ai/openlayer-ts/commit/62d890d2a86dd14213ae439817a8fe573911ca13))
* link to docs in README for example usage ([4cff313](https://github.com/openlayer-ai/openlayer-ts/commit/4cff3135939c402c01d9846f25c8d54127e56edb))
* update doc comments for throwable methods ([db16328](https://github.com/openlayer-ai/openlayer-ts/commit/db16328c5542c054b54d136766ae67ac33101bc3))
* update logo image in README ([89873ec](https://github.com/openlayer-ai/openlayer-ts/commit/89873ec8f18615464913c4f9a12acea052b2a761))
* update package version ([7b8d549](https://github.com/openlayer-ai/openlayer-ts/commit/7b8d549422124674040d4aa3b4d685e02b6222a6))
* update package version ([c50091c](https://github.com/openlayer-ai/openlayer-ts/commit/c50091ce49c93b044aa68a08b7b104e9d9edff9d))
