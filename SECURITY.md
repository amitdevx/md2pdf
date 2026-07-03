# Security Policy

## 1. Supported Versions

Security updates are provided exclusively for the latest major and minor releases. We strongly advise all users to ensure their environments are running a supported version to mitigate potential risks.

| Version | Supported          |
| :---    | :---               |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

## 2. Maintainer Availability & Policy Suspension

Please note that this project is maintained on a voluntary basis. 

**Suspension of Support Clause:** In the event that this repository exhibits no public commit activity or official releases for a consecutive period of three (3) months or more, it shall be formally deemed that the principal maintainer is temporarily unavailable. During any such period of dormancy, this Security Policy is considered suspended. Consequently, security support, vulnerability triage, and the issuance of patch updates cannot be guaranteed and should be considered compromised until active maintenance resumes. Users must exercise their own discretion and risk assessment during such periods.

## 3. Reporting a Vulnerability

We treat the security of `md2pdf` with the utmost seriousness. If you identify a potential security vulnerability, we request that you adhere to the following coordinated disclosure process rather than submitting a public issue or pull request.

### 3.1. Disclosure Process

Please submit comprehensive vulnerability reports directly to the project maintainer via private communication channels (such as the email address listed on the maintainer's GitHub profile).

To facilitate a swift and accurate assessment, please ensure your report includes:
- A detailed description of the vulnerability type and its potential impact.
- Step-by-step instructions to reliably reproduce the issue.
- The specific versions of `md2pdf`, Node.js, and the operating system utilized during your testing.
- Any applicable proof-of-concept (PoC) or exploit code.

You can anticipate an initial acknowledgment of your report within 48 hours of submission, provided the repository is in a state of active maintenance (as defined in Section 2).

### 3.2. Response and Remediation

1. **Investigation:** The maintainer will conduct a thorough investigation to validate and reproduce the reported vulnerability using the provided documentation.
2. **Resolution & Timelines:** If the vulnerability is verified, we will commence remediation efforts and provide an estimated timeline for the deployment of a patch. If the vulnerability is declined or cannot be reproduced, a comprehensive technical rationale will be provided.
3. **Public Disclosure:** Upon the successful development of a patch, a coordinated public disclosure will be executed simultaneously with the patch release, ensuring that the user base can update their deployments securely and promptly.
