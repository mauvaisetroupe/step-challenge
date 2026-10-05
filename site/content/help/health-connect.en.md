---
title: Health Connect
description: Allow Step Challenge to read your steps from Health Connect, on any Android phone.
weight: 1
---

On Android, Step Challenge reads your steps from **Health Connect**, the
health data hub of Android. Health Connect collects the steps counted by
your phone and by the watch and fitness apps that write to it (Garmin
Connect, Samsung Health, Zepp, Mi Fitness and many others).

Step Challenge only asks to **read your steps**: no other health data.

## 1. Check that Health Connect is available

- **Android 14 and later**: Health Connect is part of the system. You
  find it in the phone settings (search for "Health Connect").
- **Android 13 and earlier**: install the
  [Health Connect app](https://play.google.com/store/apps/details?id=com.google.android.apps.healthdata)
  from Google Play.

## 2. Allow access to your steps

The first time Step Challenge reads your steps, Android shows the Health
Connect permission screen. Allow **Steps**.

If you refused, or want to check:

1. Open **Health Connect** (phone settings, then search for "Health
   Connect").
2. Go to **App permissions**, then **Step Challenge**.
3. Turn on **Steps**.

The names of the menus may differ slightly depending on your phone's
brand and Android version.

## 3. Let your watch write to Health Connect

If you count your steps with a watch, its app must **send** your steps
to Health Connect. In the watch app (Garmin Connect, Samsung Health,
Zepp, Mi Fitness…), look for Health Connect in its settings and allow it
to write **Steps**.

> **Huawei watch?** Huawei Health does not send its data to Health
> Connect. See the [Huawei help]({{< relref "help/huawei" >}}).

## 4. Check in the app

- Opening the app updates today's steps. The app also synchronizes in
  the background, about once a day.
- If steps are missing: **Settings** tab (*Paramètres*), **Diagnostic**
  section, **Run the diagnostic** (*Lancer le diagnostic*). It checks
  Health Connect, the permission and the connection to the server.

Still stuck? Read the [FAQ]({{< relref "faq" >}}) or write to
[support@architech.lu](mailto:support@architech.lu).
