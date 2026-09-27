# Langili

Langili is a language-learning application delivered across web, iPhone, and Android from one shared product experience.

## Language

**Langili**:
The product and application being built in this repository.
_Avoid_: language_app, Glauq

**Platform**:
The runtime surface on which Langili is being used: `web`, `ios`, or `android`.
Platform is independent of application environment.

**Application environment**:
The backend and configuration target used by Langili: `development`, `staging`, or `production`.
Application environment is independent of platform.
_Avoid_: using environment to mean web, iPhone, or Android

**App version**:
The user-facing release version of the running Langili application.

**Native build number**:
The platform-specific revision of an installed Langili binary: the iOS build number or Android version code.
_Avoid_: build number for web deployments or over-the-air updates

**Update identifier**:
The identity of the EAS Update currently running in Langili.
_Avoid_: commit SHA, native build number

**Client revision**:
The source commit used to produce the running Langili client artifact.
_Avoid_: API version

**API version**:
The deployment revision reported by the Langili API.
_Avoid_: app version, client revision

**Canonical staging origin**:
The stable network origin used by Langili clients to reach the staging deployment built from the `stage` branch.
It is distinct from the development deployment.

**Development deployment**:
The protected web and API deployment built from the `dev` branch, where merged work is first checked by a person.
A development deployment uses the `development` application environment.
_Avoid_: preview deployment, dev environment

**Promotion**:
A human merge that moves already-checked work to the next branch: `dev` to `stage`, and later `stage` to `prod`.
Promoting to `stage` declares that the development deployment looked right, and requires approval from an acceptance approver other than the person who opened the promotion.
_Avoid_: release, tag

**Authorized tester**:
A person permitted to access protected Langili development and staging deployments.
For the first skeleton milestone, the authorized testers are `harminder0209` and `singhpankaj99`.

**Acceptance approver**:
An authorized tester permitted to declare the Langili skeleton or pipeline-validation change successful after all required evidence has been recorded.
For the first skeleton milestone, either `harminder0209` or `singhpankaj99` may approve independently.
