# Changelog

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
