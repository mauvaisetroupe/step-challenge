---
title: Privacy Policy — Step Challenge
linkTitle: Privacy policy
description: What data Step Challenge collects, why, and how to delete it.
updated: 4 October 2026
---

Step Challenge is a step-counting and challenge application that allows
users to track their daily steps and participate in step challenges.

## 1. Data we collect

Step Challenge collects only the data necessary to provide its services.

### Account information

Users sign in to Step Challenge with their Google account. When signing
in, Google provides the application with a signed identity token. From
this token, Step Challenge stores only:

- The stable, technical Google account identifier (the OpenID Connect
  "subject"), used to recognize the user at their next sign-in;
- A display name chosen by the user, shown to other participants. The
  application suggests the first name of the Google account, which the
  user can change before saving it and at any time afterwards.

Step Challenge does **not** store the user's email address, profile
photo or any other Google account information, and does not access any
Google service on the user's behalf.

After sign-in, the application keeps a session token in the device's
secure storage (Android Keystore). The server keeps only a cryptographic
hash of this token.

### Step data

When the user gives permission, Step Challenge can read step-count data
from the health platform available on the user's device.

On Android, Step Challenge uses **Health Connect** to read step counts
recorded by the phone or by compatible devices and applications (for
example Garmin, Samsung or Xiaomi). Step Challenge only requests read
access to step data.

On Huawei devices, Step Challenge uses **Huawei Health Kit** to access
step-count data made available by Huawei Health and compatible devices.

Step data may include:

- The number of steps recorded for a given day;
- The date associated with the step count.

Step Challenge does not request access to unrelated health information
such as heart rate, sleep, blood pressure, body measurements or medical
information unless such access is explicitly described in a future
version of the application.

## 2. How we use step data

Step data is used only to provide Step Challenge functionality,
including:

- Displaying the user's daily step count;
- Displaying step history and statistics;
- Calculating challenge and leaderboard results;
- Synchronizing step counts with the Step Challenge service.

Step data is not used for advertising, profiling, marketing or medical
purposes.

Step data obtained through Huawei Health Kit is not sold or shared with
third parties for their own advertising or profiling purposes.

## 3. Huawei Health Kit

On compatible Huawei devices, Step Challenge uses Huawei Health Kit to
access authorized fitness data.

Step Challenge can access Health Kit data only after the user has
granted the corresponding permission.

The user can withdraw this authorization through the relevant Huawei
Health or device privacy and permission settings.

If permission is denied or withdrawn, Step Challenge will no longer be
able to retrieve new step data from Huawei Health Kit. Previously
synchronized data may remain stored by Step Challenge until it is
deleted according to this policy.

## 4. Synchronization with Step Challenge servers

When synchronization is enabled, Step Challenge sends the user's daily
step counts to the Step Challenge backend.

The server stores step counts associated with the user's Step Challenge
account so that the application can:

- Synchronize data between devices;
- Maintain step history;
- Calculate challenges;
- Provide leaderboards.

The server does not receive the user's complete Huawei Health database.
Step Challenge only processes the step information required by the
application.

## 5. Data sharing

Step Challenge does not sell personal data.

Step Challenge does not share step data with advertisers, data brokers
or other third parties for advertising or profiling.

Step data may be processed by technical service providers required to
operate the application and its infrastructure, where applicable, and
only for purposes necessary to provide the service.

## 6. Data retention

Step Challenge retains synchronized step data only for as long as
necessary to provide the application's features, including step
history, challenges and statistics.

Users can delete their Step Challenge account at any time from the
application: **Settings → Delete my account**. This immediately and
permanently deletes, on the server, the account, its display name, its
link to the Google account, its sessions and its entire step history.
Step data stored in Health Connect or Huawei Health on the device is not
affected.

Users who no longer have access to the application can request the
deletion of their account and associated server-side data by email (see
the Contact section). Both procedures are described on the
[account deletion page]({{< relref "delete-account" >}}).

Data stored locally on the user's device may also be removed by
uninstalling the application or using the application's available
data-deletion functionality.

## 7. Security

Reasonable technical and organizational measures are used to protect
Step Challenge data against unauthorized access, alteration, disclosure
or destruction.

## 8. Your rights

Depending on applicable data protection law, users may have rights
including:

- Access to their personal data;
- Correction of inaccurate data;
- Deletion of their personal data;
- Withdrawal of consent where processing is based on consent;
- Restriction or objection to certain processing;
- Data portability where applicable.

Users can also revoke Step Challenge's access to Huawei Health data
through the relevant Huawei Health or device permission settings.

## 9. Children's privacy

Step Challenge is not intended to knowingly collect personal information
from children in violation of applicable law.

## 10. Changes to this policy

This privacy policy may be updated when Step Challenge introduces new
functionality or when legal or technical requirements change.

The latest version will always be published at the privacy policy URL
provided to users and application platforms.

## 11. Contact

For questions about this privacy policy, personal data or requests
concerning your data, please contact:

Step Challenge is developed and operated by **Lionel Coquin**, acting as
a private individual, who is the data controller for the personal data
processed by the application and its server.

**Step Challenge — Lionel Coquin**\
Email: **support@architech.lu**

## 12. Open source

The source code of the Step Challenge application and server is public,
under the GNU Affero General Public License (AGPL-3.0), so that anyone
can verify how data is processed:
[github.com/mauvaisetroupe/step-challenge](https://github.com/mauvaisetroupe/step-challenge).
