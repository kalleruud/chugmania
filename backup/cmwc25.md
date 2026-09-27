# Chugmania World Championship 2025

This is a frozen, human-readable record of the event. The app recorded the group stage; the knockout was completed in Challonge after the tournament feature failed. The Challonge PDF is the source for final bracket results. IDs below are retained for a future import.

## Sources and scope

- [Final Challonge bracket](27.09.2026-tournament/cmwc25.pdf)
- [Tournament](27.09.2026-tournament/tournaments.csv), [groups](27.09.2026-tournament/groups.csv), [group players](27.09.2026-tournament/groupPlayers.csv), and [tournament fixtures](27.09.2026-tournament/tournamentMatches.csv) are the original CSV exports with their full fields and timestamps.
- The session, users, tracks, signups, matches, and time entries below were read from the restored production `data/db.sqlite` on 2026-09-27. These tables are not included in the four tournament CSV files.
- All times below are local to Europe/Oslo. `—` means the source field is empty; it is not an inferred value.

## Session and tournament setup

| Field                  | Value                                |
| ---------------------- | ------------------------------------ |
| Session ID             | d61cce22-7d6e-47eb-bbad-64b7731f8042 |
| Session name           | Chugmania World Championship 2025    |
| Scheduled start        | 2026-01-03 17:00:00                  |
| Location               | Fjellmusveien 2, 1356 Bekkestua      |
| Session status         | confirmed                            |
| Tournament ID          | 84d81f14-d237-4713-b44d-a10e1c888f2c |
| Tournament name        | CMWC25                               |
| Tournament description | yeehaw                               |
| Group count            | 4                                    |
| Advance per group      | 2                                    |
| Elimination format     | double                               |

### Original session description

> BEKREFTET! Vi kjører Chuggolini World Championship 3 Jan 2026! Viktig å møte opp i tide, gruppespillet starter kvart over!

> Ta med minst en sixpack med 0.5 L, tror det meste man kan slumpe til å drikke om man vinner er rundt 10 burker. Ta med noe godt å drikke utenom rundene også!

> Vi kjører i huset til mamma og pappa! Estimert chuggemengde er 5-10 øl. Jo mer du vinner jo mer må chugges!

## Participants and group results

19 players were assigned across 4 groups. Seed values are the rating values saved in the backup. W–L counts are derived from the completed group matches; they are not stored standings or tie-break ranks.

### Gruppe A

Group ID: `e18b5104-1e4d-4965-b038-a3c44f0baae3`

| Player                | User ID                                | Group-player ID                        | Saved seed         | W–L |
| --------------------- | -------------------------------------- | -------------------------------------- | ------------------ | --- |
| Ole Kallerud (OLE)    | `eb0aeea8-5acb-4ed8-9297-683ae6714850` | `f767c981-1009-4403-941a-52f6dd13a3bb` | 1638.6530783527155 | 3–1 |
| Johan Busk (BUS)      | `e282c223-58a4-4f66-9e9c-92bed56aa532` | `dd697e39-7463-41a0-ab50-1f26435a2b14` | 1283.2427429833556 | 3–1 |
| Erik Almåsvold (ERI)  | `5ff55487-ce53-4812-8e0e-282ef8c1bae5` | `80b890e0-184d-412b-945d-f7460294375a` | 1257.2155462741484 | 0–4 |
| Mikael Rodvelt (ROD)  | `c52a3f17-2b60-43be-96c5-219c3751fb23` | `8b363e22-2623-4dd5-ad0f-9a207544ef5a` | 850.7873491391197  | 2–2 |
| Birk The skurk (BIRK) | `1320b514-fa5c-8081-ae21-cf34f97a7bb5` | `a1c40a47-bee0-4577-8ad3-69eb747e1bfe` | 672.5517551800365  | 2–2 |

### Gruppe B

Group ID: `eeb4a024-4ac9-42db-92a2-cb39d85c9d82`

| Player                  | User ID                                | Group-player ID                        | Saved seed         | W–L |
| ----------------------- | -------------------------------------- | -------------------------------------- | ------------------ | --- |
| Sondre Kristensen (KRI) | `8e97f7b6-4aa5-4c12-b364-e46ef4b0a695` | `91a3c379-458a-4564-8d73-13781477b5a4` | 1636.328516174552  | 3–1 |
| Sindre Sauarlia (SAU)   | `0d8450e9-15c2-4270-adf4-913f584a84f9` | `c0def43a-f5bf-44cf-a5b2-c365c7c09548` | 1285.2128686751196 | 3–1 |
| Johannes Sognnæs (SOG)  | `294142d8-a13c-423a-b062-78df13ab4fb2` | `ac5b132b-6659-48fc-8b73-a7c966070abb` | 1211.7804674877325 | 1–3 |
| Håkon Busk (HAWK)       | `e53a24cd-bbe4-4f33-9394-56303852efb7` | `8d8b1d9f-789c-4bf3-a616-a32110669be1` | 996.9330735904266  | 0–4 |
| Even Galåsen (GAL)      | `98db5c20-2526-4318-a4dd-ce2db8726cdd` | `068c3080-8e79-4525-bd38-8a88a2d084d1` | 0                  | 3–1 |

### Gruppe C

Group ID: `dd0432cd-57af-4906-9b11-394410e50278`

| Player                 | User ID                                | Group-player ID                        | Saved seed         | W–L |
| ---------------------- | -------------------------------------- | -------------------------------------- | ------------------ | --- |
| Joppe Joppe (JOPE)     | `313dde00-aa9b-4c57-bd0d-af76f95db3c3` | `04db4107-29b8-42f0-a355-a32a4bb2abb8` | 1448.7165685331506 | 4–0 |
| Fredrik Hyldmo (FHY)   | `93ad2385-2d34-4127-b4ea-f5a287de3717` | `29c6e653-5a9f-4a52-b5a9-87482bf20ff3` | 1303.80064817041   | 3–1 |
| Boye Wolla (WOL)       | `13bb8b6b-dae7-4533-8b46-883b73a66cf5` | `9d308f24-2642-4361-9b0e-6c4f28e5bbdd` | 1121.7216666956156 | 1–3 |
| Kenneth Solvoll (KSO)  | `624ac48c-089b-4794-b6ac-5f091d8d640a` | `f977c927-cc6b-42ed-b8b2-876493e2f90f` | 1029.1801079832503 | 2–2 |
| Andreas Hundsnes (HUN) | `feee5dc8-d7bd-41f8-966f-a64e77b7079b` | `11dfde44-6e8b-4870-9dfb-78b80c12b3bb` | 0                  | 0–4 |

### Gruppe D

Group ID: `a2e9ffff-035d-4de8-9c11-a61c101e0636`

| Player                    | User ID                                | Group-player ID                        | Saved seed         | W–L |
| ------------------------- | -------------------------------------- | -------------------------------------- | ------------------ | --- |
| Sindre Haram (HAR)        | `48795c18-bace-4a2d-be67-1b209fe5b654` | `411d6dd0-630c-43fa-9ffa-ec27fc1795fe` | 1436.116376000554  | 2–1 |
| Axel Ericson (AXEL)       | `57723541-3f15-48c9-8c11-22b04b1735fd` | `8b8f1031-be5f-445b-a5b9-8c2cefcd261b` | 1412.477351869941  | 2–1 |
| Sebastian Pettersen (SEB) | `2d04152e-bc0a-4712-9c1d-4b387e2d7c83` | `d7bcd86b-4b16-45f4-8661-58c8f90ed5d7` | 1107.6299142566336 | 2–1 |
| Kristian Nielsen (NIE)    | `b7c17d71-ab5c-4a37-b0a6-fe8cc80887c5` | `45ddb6e9-cc83-4d78-a444-d6adadb26373` | 1091.9177385425564 | 0–3 |

## Group-stage matches recorded in Chugmania

All 36 linked group matches are marked completed in the database. It stores a winner, but no 1–0 score or match duration. The fixture names in the export repeat, so IDs identify each row.

### Gruppe A

| Completed           | Players     | Winner | Track                | Match ID                               | Fixture ID                             | Comment |
| ------------------- | ----------- | ------ | -------------------- | -------------------------------------- | -------------------------------------- | ------- |
| 2026-01-03 17:48:26 | ERI vs ROD  | ROD    | 75 / green / stadium | `518a340b-d22c-40e3-ae30-7cc2f2437938` | `08bdbc89-22cd-4211-8a9a-4313da1169a0` | —       |
| 2026-01-03 18:00:31 | BUS vs BIRK | BUS    | 75 / green / stadium | `75a672e7-fe83-4e5c-841c-eeb1ac7c63c1` | `39992afa-6cda-4f25-bf84-d5d61d81abd8` | —       |
| 2026-01-03 18:07:12 | OLE vs ROD  | ROD    | 75 / green / stadium | `cf2a7364-acc3-49d5-b8c0-9f767d77b183` | `4078f332-f566-448d-b2a4-e9d5bc2c97c1` | —       |
| 2026-01-03 18:22:23 | OLE vs BIRK | OLE    | 75 / green / stadium | `7214ab12-d916-46ea-9a84-c72bbbc33747` | `3aa41a98-467f-4665-b6ba-36a17333ba75` | —       |
| 2026-01-03 18:45:35 | BUS vs ERI  | BUS    | 90 / blue / drift    | `2edf8c2c-65b9-47a7-8bf2-733333a23afd` | `c3371277-a5c2-4689-ba01-e97ba5bc0b18` | —       |
| 2026-01-03 19:12:34 | BUS vs ROD  | BUS    | 90 / blue / drift    | `4a023157-fbfd-4632-9a0c-996822f5f698` | `f4f0a2ad-7875-4989-a9b5-7a5ae9568676` | —       |
| 2026-01-03 19:34:59 | OLE vs ERI  | OLE    | 90 / blue / drift    | `e4c2de8b-6c95-4cc6-a2f9-a138df1df02b` | `3c8c6841-2302-46f6-8bed-3de6d84411ef` | —       |
| 2026-01-03 19:50:17 | ROD vs BIRK | BIRK   | 90 / blue / drift    | `c30372e3-02ce-462c-a68a-f83054d3f4f6` | `d433b3d5-3c6b-49ba-af5e-95df238656dc` | —       |
| 2026-01-03 20:00:39 | OLE vs BUS  | OLE    | 90 / blue / drift    | `eeff155a-b81b-4d9b-a17f-6b72e0d1ae25` | `1a53a02c-2016-4176-9b8b-bc61fe437b65` | —       |
| 2026-01-03 20:10:43 | ERI vs BIRK | BIRK   | 90 / blue / drift    | `ff33de32-2bfb-40c5-ac8e-b12bdbb3d74f` | `854adbb3-9a8f-4205-84d8-14ba0c5b6526` | —       |

### Gruppe B

| Completed           | Players     | Winner | Track                | Match ID                               | Fixture ID                             | Comment               |
| ------------------- | ----------- | ------ | -------------------- | -------------------------------------- | -------------------------------------- | --------------------- |
| 2026-01-03 17:45:41 | HAWK vs GAL | GAL    | 75 / green / stadium | `c9638413-3d62-4562-aaad-1647f0ef231c` | `7b7d4ae0-610d-4c96-bba1-3320479bae0e` | —                     |
| 2026-01-03 17:57:15 | SAU vs SOG  | SAU    | 75 / green / stadium | `144f56d5-9b45-49b3-8c38-ed1719d670c5` | `2c1bc45a-1b49-4741-9afe-d5236d41f3b8` | —                     |
| 2026-01-03 18:10:15 | KRI vs SOG  | KRI    | 75 / green / stadium | `46fc8db3-9ae3-449d-9df1-04e503cc6efa` | `9bd44c75-08de-412c-8b7e-387d85911925` | —                     |
| 2026-01-03 18:19:00 | SAU vs HAWK | SAU    | 75 / green / stadium | `f40aac3d-0bed-49fb-a146-13056ba108d9` | `44fa738b-bd69-4c00-b7db-b83752c97f7e` | —                     |
| 2026-01-03 18:28:46 | SOG vs GAL  | GAL    | 75 / green / stadium | `bd6deed2-bb8f-4fe7-bd17-a87b1844d1cd` | `0d3171b7-2212-4fb3-ba38-a3b8b626f8d9` | —                     |
| 2026-01-03 18:31:56 | KRI vs SAU  | KRI    | 75 / green / stadium | `b80b0a9b-528a-48be-bb72-3aa5f96fd604` | `efe9f245-2f86-47a1-b423-7187a3867887` | —                     |
| 2026-01-03 18:58:29 | KRI vs GAL  | GAL    | 90 / blue / drift    | `bb5f1215-4d39-4db2-a34b-6258d5236026` | `632bc4a3-dca8-41cc-9d76-20ec08197618` | SONDRE TRYKKA RUNDING |
| 2026-01-03 19:29:12 | SOG vs HAWK | SOG    | 90 / blue / drift    | `698332cb-759d-4434-880b-d0dfd84c247a` | `62a6840d-d166-4dff-8e6f-3de87870cc71` | —                     |
| 2026-01-03 19:44:36 | SAU vs GAL  | SAU    | 90 / blue / drift    | `dca243de-5e9b-4360-92c9-21533b7e34ec` | `dad6afbe-8de5-4e69-886d-fa154eeb384d` | —                     |
| 2026-01-03 19:55:23 | KRI vs HAWK | KRI    | 90 / blue / drift    | `e3d3ac3f-e1d1-4512-a718-c9bc8fc136c3` | `adc74a57-a53b-4a27-bdf4-04ce03a0e90b` | —                     |

### Gruppe C

| Completed           | Players     | Winner | Track                | Match ID                               | Fixture ID                             | Comment |
| ------------------- | ----------- | ------ | -------------------- | -------------------------------------- | -------------------------------------- | ------- |
| 2026-01-03 17:39:43 | WOL vs KSO  | KSO    | 75 / green / stadium | `4959997f-66e8-4232-b313-2b19a06542df` | `ff474beb-7b34-4a40-8895-e2c213d5c9e5` | —       |
| 2026-01-03 17:54:14 | FHY vs HUN  | FHY    | 75 / green / stadium | `ed770d5f-759d-4148-afd4-4b8692676cd5` | `f1ac94ff-c5e5-4f49-b97c-ceb4c7cb5225` | —       |
| 2026-01-03 18:04:39 | JOPE vs KSO | JOPE   | 75 / green / stadium | `019fee04-028d-4593-b481-6b5bd8f19589` | `2a80b610-a3cd-4f4b-95f7-c3071e458769` | —       |
| 2026-01-03 18:16:12 | JOPE vs HUN | JOPE   | 75 / green / stadium | `e2c89bad-a46f-4568-a662-d3a1e445f26e` | `cf12fc15-678e-4cf9-8707-6756c8e50de8` | —       |
| 2026-01-03 18:40:57 | WOL vs HUN  | WOL    | 90 / blue / drift    | `df31219b-9eab-4160-9570-85359665c61b` | `fcf0ab5b-1e3a-4493-a953-173b23780581` | —       |
| 2026-01-03 18:51:57 | FHY vs KSO  | FHY    | 90 / blue / drift    | `e2aed676-2dba-4f24-824d-ec12fc4c71e4` | `2e3c2605-3302-4337-b820-8a94f1a30745` | —       |
| 2026-01-03 19:07:14 | JOPE vs WOL | JOPE   | 90 / blue / drift    | `6e0ecd38-c149-423e-8885-776993d2f970` | `c1821242-7989-4c3d-8aea-dd4adacd30f7` | —       |
| 2026-01-03 19:23:31 | KSO vs HUN  | KSO    | 90 / blue / drift    | `2c8e6e60-4643-40e6-a502-61811c208cb5` | `c1daf7f1-7c54-4f26-916e-4c5cdbd7521e` | —       |
| 2026-01-03 19:39:26 | FHY vs WOL  | FHY    | 90 / blue / drift    | `de964640-32fb-4119-8d4d-f345cc202191` | `bd892215-58f9-4788-9d13-a816e19be400` | —       |
| 2026-01-03 20:05:44 | JOPE vs FHY | JOPE   | 90 / blue / drift    | `312ad61b-3e36-4650-9b82-2c47ecb8b3b3` | `3b28aea2-fdc7-46d3-9cd5-062da342c330` | —       |

### Gruppe D

| Completed           | Players     | Winner | Track                | Match ID                               | Fixture ID                             | Comment |
| ------------------- | ----------- | ------ | -------------------- | -------------------------------------- | -------------------------------------- | ------- |
| 2026-01-03 17:32:49 | SEB vs NIE  | SEB    | 75 / green / stadium | `3fc3d29e-1237-42e1-9295-256f252800f6` | `79fe81e6-0c23-4ede-abf5-06d4b781a811` | —       |
| 2026-01-03 17:51:19 | HAR vs AXEL | HAR    | 75 / green / stadium | `14c73857-2c62-4181-acef-c8753d76e492` | `d4a4fd76-4a67-4065-b36b-542ee1990c61` | —       |
| 2026-01-03 18:13:27 | AXEL vs NIE | AXEL   | 75 / green / stadium | `09dec5c1-5397-4171-aec3-2c7aac8a2099` | `dadf75ce-e8fb-400b-bbc4-a63bb960d837` | —       |
| 2026-01-03 18:25:48 | HAR vs SEB  | SEB    | 75 / green / stadium | `6581469a-bbc5-43d8-9b9d-7ae0940176b4` | `fe7560cd-d35a-4f23-bd10-27262d1f7f7d` | —       |
| 2026-01-03 19:02:44 | AXEL vs SEB | AXEL   | 90 / blue / drift    | `a1ab98d0-ec11-4000-9cbd-e7213c947f8a` | `e03e29cf-3a3d-4390-806c-da7aefa0aeb5` | —       |
| 2026-01-03 19:17:39 | HAR vs NIE  | HAR    | 90 / blue / drift    | `1b90e886-ba61-46ca-8ca7-c0acc078b26e` | `cd16f7dc-0709-4081-afc2-efb316df755f` | —       |

## Final knockout results from Challonge

The PDF uses 1 for a win and 0 for a loss. Bracket seeds shown there are JOPE 1, OLE 2, KRI 3, FHY 4, HAR 5, AXEL 6, GAL 7, and BUS 8. Its numbered games below are kept distinct from the app fixture IDs.

| PDF game | Round               | Players     | Score | Winner |
| -------- | ------------------- | ----------- | ----- | ------ |
| 1        | Upper round 1       | JOPE vs BUS | 1–0   | JOPE   |
| 2        | Upper round 1       | FHY vs HAR  | 0–1   | HAR    |
| 3        | Upper round 1       | OLE vs GAL  | 1–0   | OLE    |
| 4        | Upper round 1       | KRI vs AXEL | 0–1   | AXEL   |
| 5        | Lower round 1       | BUS vs FHY  | 0–1   | FHY    |
| 6        | Lower round 1       | GAL vs KRI  | 0–1   | KRI    |
| 7        | Upper round 2       | JOPE vs HAR | 0–1   | HAR    |
| 8        | Upper round 2       | OLE vs AXEL | 1–0   | OLE    |
| 9        | Lower round 2       | JOPE vs KRI | 1–0   | JOPE   |
| 10       | Lower round 2       | AXEL vs FHY | 0–1   | FHY    |
| 11       | Lower round 3       | FHY vs JOPE | 1–0   | FHY    |
| 12       | Upper bracket final | HAR vs OLE  | 1–0   | HAR    |
| 13       | Lower bracket final | OLE vs FHY  | 1–0   | OLE    |
| 14       | Grand final         | HAR vs OLE  | 0–1   | OLE    |
| 15       | Grand final reset   | OLE vs HAR  | 0–1   | HAR    |

**Champion: Sindre Haram (HAR). Runner-up: Ole Kallerud (OLE).** Fredrik Hyldmo (FHY) lost the lower bracket final to OLE. HAR lost the first grand final, then won the reset game.

## Final standings

The Challonge bracket determines the first eight places. Players eliminated in the same lower-bracket round are ordered by their fastest active session time. The remaining players are ordered by group win percentage because the groups played different numbers of matches, then by fastest active session time. Equal times, or missing times that prevent a comparison, leave players tied at the same place. Deleted time entries are excluded. FHY and JOPE have no active time entry, but their different bracket finishes determine their places.

| Place | Player                    | Finish              | Group W–L | Fastest active time (s) |
| ----- | ------------------------- | ------------------- | --------- | ----------------------- |
| 1     | Sindre Haram (HAR)        | Champion            | 2–1       | 80.63                   |
| 2     | Ole Kallerud (OLE)        | Runner-up           | 3–1       | 80.91                   |
| 3     | Fredrik Hyldmo (FHY)      | Lower-bracket final | 3–1       | —                       |
| 4     | Joppe Joppe (JOPE)        | Lower round 3       | 4–0       | —                       |
| 5     | Sondre Kristensen (KRI)   | Lower round 2       | 3–1       | 82.19                   |
| 6     | Axel Ericson (AXEL)       | Lower round 2       | 2–1       | 82.21                   |
| 7     | Even Galåsen (GAL)        | Lower round 1       | 3–1       | 92.33                   |
| 8     | Johan Busk (BUS)          | Lower round 1       | 3–1       | 94.15                   |
| 9     | Sindre Sauarlia (SAU)     | Group stage         | 3–1       | 106.55                  |
| 10    | Sebastian Pettersen (SEB) | Group stage         | 2–1       | 111.98                  |
| 11    | Kenneth Solvoll (KSO)     | Group stage         | 2–2       | 83.97                   |
| 12    | Mikael Rodvelt (ROD)      | Group stage         | 2–2       | 95.30                   |
| 13    | Birk The skurk (BIRK)     | Group stage         | 2–2       | 109.54                  |
| 14    | Boye Wolla (WOL)          | Group stage         | 1–3       | 83.57                   |
| 15    | Johannes Sognnæs (SOG)    | Group stage         | 1–3       | 85.91                   |
| 16    | Erik Almåsvold (ERI)      | Group stage         | 0–4       | 86.90                   |
| 17    | Andreas Hundsnes (HUN)    | Group stage         | 0–4       | 88.61                   |
| 18    | Håkon Busk (HAWK)         | Group stage         | 0–4       | 92.91                   |
| 19    | Kristian Nielsen (NIE)    | Group stage         | 0–3       | 103.31                  |

## Knockout fixtures left in the old tournament export

The 14 fixture rows below are the abandoned app bracket template. Only the four quarterfinals had linked app matches, and those matches are now `cancelled` with no winner. The CSV has no result for the PDF knockout games, including the reset game.

| Fixture           | Bracket / round | Source A                                         | Source B                                         | App match / status                                 | Fixture ID                             |
| ----------------- | --------------- | ------------------------------------------------ | ------------------------------------------------ | -------------------------------------------------- | -------------------------------------- |
| Kvartfinale 1     | upper / 8       | Gruppe A rank 1                                  | Gruppe B rank 1                                  | `cea5e4a3-02db-4647-b92f-ca433aa9e801` / cancelled | `c5c2327e-5bc4-44cc-b80e-018ac2d28fd0` |
| Kvartfinale 2     | upper / 8       | Gruppe C rank 1                                  | Gruppe D rank 1                                  | `cc3605fa-f1f5-4ba9-b91d-e9b27da49311` / cancelled | `ca11d963-4467-4f0a-9781-ae77cca2ba0c` |
| Kvartfinale 3     | upper / 8       | Gruppe A rank 2                                  | Gruppe B rank 2                                  | `6eaa7084-2be7-438e-a69e-4d3617d40b6a` / cancelled | `dae50723-495c-4191-97a8-78720681f9d4` |
| Kvartfinale 4     | upper / 8       | Gruppe C rank 2                                  | Gruppe D rank 2                                  | `a3db2c44-d97c-498f-8cc6-75cc42d7ad81` / cancelled | `6d005b77-4654-4b1c-9574-714721b4f463` |
| Semifinale 1      | upper / 4       | winner of `c5c2327e-5bc4-44cc-b80e-018ac2d28fd0` | winner of `ca11d963-4467-4f0a-9781-ae77cca2ba0c` | —                                                  | `820d51a4-dddd-4b21-9fd4-671a5621925d` |
| Semifinale 2      | upper / 4       | winner of `dae50723-495c-4191-97a8-78720681f9d4` | winner of `6d005b77-4654-4b1c-9574-714721b4f463` | —                                                  | `97525ca1-0dd5-42f0-9e66-c4bf28c61047` |
| Finale 1          | upper / 2       | winner of `820d51a4-dddd-4b21-9fd4-671a5621925d` | winner of `97525ca1-0dd5-42f0-9e66-c4bf28c61047` | —                                                  | `903579df-cac7-4683-90ed-a2e1e80eafe1` |
| Taper Runde 1 - 1 | lower / 1       | loser of `c5c2327e-5bc4-44cc-b80e-018ac2d28fd0`  | loser of `ca11d963-4467-4f0a-9781-ae77cca2ba0c`  | —                                                  | `a4eb86e0-fba9-44b7-96a0-609102335944` |
| Taper Runde 1 - 2 | lower / 1       | loser of `dae50723-495c-4191-97a8-78720681f9d4`  | loser of `6d005b77-4654-4b1c-9574-714721b4f463`  | —                                                  | `d1063df4-f246-41f0-bfc5-4b87ff9fed66` |
| Taper Runde 2 - 1 | lower / 2       | winner of `a4eb86e0-fba9-44b7-96a0-609102335944` | loser of `820d51a4-dddd-4b21-9fd4-671a5621925d`  | —                                                  | `27ce871c-7e58-4b4c-ba2f-d64ea51d4cb6` |
| Taper Runde 2 - 2 | lower / 2       | winner of `d1063df4-f246-41f0-bfc5-4b87ff9fed66` | loser of `97525ca1-0dd5-42f0-9e66-c4bf28c61047`  | —                                                  | `11bc9223-36ad-4ea4-8da9-39514feeda3c` |
| Taper Runde 3 - 1 | lower / 3       | winner of `27ce871c-7e58-4b4c-ba2f-d64ea51d4cb6` | winner of `11bc9223-36ad-4ea4-8da9-39514feeda3c` | —                                                  | `b9f1b751-adc5-4d94-86b7-ce850f9d63f3` |
| Taper Runde 4 - 1 | lower / 4       | winner of `b9f1b751-adc5-4d94-86b7-ce850f9d63f3` | loser of `903579df-cac7-4683-90ed-a2e1e80eafe1`  | —                                                  | `cd9d2ca5-80b9-4ae0-a8ca-a2577fe9220d` |
| Grand Finale      | upper / 1       | winner of `903579df-cac7-4683-90ed-a2e1e80eafe1` | winner of `cd9d2ca5-80b9-4ae0-a8ca-a2577fe9220d` | —                                                  | `d9290aed-19c6-4532-b500-1dbd9a24930f` |

The four cancelled quarterfinal app match pairings were:

| App match ID                           | Players     | Status    |
| -------------------------------------- | ----------- | --------- |
| `cea5e4a3-02db-4647-b92f-ca433aa9e801` | OLE vs KRI  | cancelled |
| `cc3605fa-f1f5-4ba9-b91d-e9b27da49311` | JOPE vs HAR | cancelled |
| `6eaa7084-2be7-438e-a69e-4d3617d40b6a` | BUS vs SAU  | cancelled |
| `a3db2c44-d97c-498f-8cc6-75cc42d7ad81` | FHY vs AXEL | cancelled |

## Other match linked to the session

This match is in the session database but not in the tournament fixture CSV or the Challonge PDF. It is preserved here without assigning it a bracket position.

| Completed / updated | Players     | Winner | Track             | Status    | Match ID                               |
| ------------------- | ----------- | ------ | ----------------- | --------- | -------------------------------------- |
| 2026-01-03 21:14:23 | HAR vs AXEL | HAR    | 5 / white / drift | completed | `946a0dbb-685a-4f41-b745-348d91014f82` |

## Session time entries

The database contains 19 linked time entries: 18 active and one deleted historical entry. Durations below are seconds; each entry records 0.5 L. Deleted entries must stay excluded from active results.

| Player | Duration (s) | Track             | Recorded            | State / comment                                        | Entry ID                               |
| ------ | ------------ | ----------------- | ------------------- | ------------------------------------------------------ | -------------------------------------- |
| OLE    | 83.63        | 5 / white / drift | 2025-11-22 00:07:00 | deleted 2025-12-05 14:48:07; Denne må være regga feil? | `63f051aa-331d-437d-8cff-e7c2f0467e72` |
| SEB    | 111.98       | 5 / white / drift | 2026-01-03 20:22:09 | active                                                 | `8e5e478f-87c4-4a6f-9539-be90354a315a` |
| GAL    | 92.33        | 5 / white / drift | 2026-01-03 20:26:43 | active                                                 | `385cad06-3994-4856-8588-15960563e192` |
| ROD    | 95.30        | 5 / white / drift | 2026-01-03 20:28:00 | active                                                 | `02f8d4c0-ebc8-4526-8359-ca504bb779f4` |
| HAR    | 82.21        | 5 / white / drift | 2026-01-03 20:29:55 | active                                                 | `5856e4bc-0dc9-4c33-8f66-78a2318d2d11` |
| NIE    | 103.31       | 5 / white / drift | 2026-01-03 20:33:45 | active                                                 | `b7dac02d-9232-43f7-80f6-71cf3abbc55d` |
| BIRK   | 109.54       | 5 / white / drift | 2026-01-03 20:36:06 | active                                                 | `3d22de9b-1583-4691-91fc-1a9d0c17963f` |
| WOL    | 83.57        | 5 / white / drift | 2026-01-03 20:38:34 | active                                                 | `c316cc53-87c8-40ce-b8b0-3251442e43bd` |
| AXEL   | 82.21        | 5 / white / drift | 2026-01-03 20:40:13 | active                                                 | `11ec7d62-37ae-4229-af5c-20433eb57429` |
| BUS    | 94.15        | 5 / white / drift | 2026-01-03 20:43:05 | active                                                 | `308f8bb0-fddf-491c-9354-0e3a8c43d433` |
| SAU    | 106.55       | 5 / white / drift | 2026-01-03 20:46:12 | active                                                 | `6cd0f433-6ca8-4777-b5a8-af8901ff5e7b` |
| HAWK   | 92.91        | 5 / white / drift | 2026-01-03 20:49:13 | active                                                 | `c84b1178-1167-4996-84e5-019d917e2147` |
| KRI    | 82.19        | 5 / white / drift | 2026-01-03 20:52:13 | active                                                 | `74416e0b-ac26-4dab-84a0-ed1c645a01d8` |
| OLE    | 80.91        | 5 / white / drift | 2026-01-03 20:54:52 | active                                                 | `c60bb16c-f6b1-4128-8ee0-d09ebefb114f` |
| ERI    | 86.90        | 5 / white / drift | 2026-01-03 20:57:43 | active                                                 | `f9a5b488-cc0f-4d6e-8342-723f5dae8a28` |
| HUN    | 88.61        | 5 / white / drift | 2026-01-03 21:00:26 | active                                                 | `d5b42291-0894-4146-a5bb-94a94499d5f9` |
| KSO    | 83.97        | 5 / white / drift | 2026-01-03 21:05:03 | active                                                 | `699776d2-c76a-48f5-b3d9-34ac25376c66` |
| SOG    | 85.91        | 5 / white / drift | 2026-01-03 21:08:12 | active                                                 | `979ab849-4ab3-4ad8-be3e-6ba932e56e4a` |
| HAR    | 80.63        | 5 / white / drift | 2026-01-03 21:14:40 | active                                                 | `d393b9dd-2aac-41ed-8ec3-603ed3c1769b` |

## Session RSVPs

19 yes and 4 no; all 19 group players have a yes RSVP. These are responses, not a separate attendance result.

| Player                    | Response | User ID                                | Signup ID                              |
| ------------------------- | -------- | -------------------------------------- | -------------------------------------- |
| Simon Tolinsson (TOL)     | no       | `3672c9eb-ba52-4879-88e8-ec8192bb2708` | `e3185fd9-5939-42dc-b6a1-ffce7b4f1686` |
| Johann Vårvik (VÅR)       | no       | `441e97e6-7805-47c5-88c8-7ab9b7d0a803` | `826fdf41-cb0b-4c39-b457-01a057634c98` |
| Robin Heitman (HEI)       | no       | `915d781a-e3a4-4de5-8ab1-d3ca7fe8063d` | `95fc1527-557b-4908-b832-8ce670af3b95` |
| Joar Hougen (HOU)         | no       | `69d24bac-9282-4746-9aad-ed6403df7b17` | `c9fef55d-5eac-496a-9309-3a18e65ada90` |
| Ole Kallerud (OLE)        | yes      | `eb0aeea8-5acb-4ed8-9297-683ae6714850` | `f6fbe76d-6e27-4e42-b16d-fb53a64fe7b7` |
| Johannes Sognnæs (SOG)    | yes      | `294142d8-a13c-423a-b062-78df13ab4fb2` | `c43e2992-a587-4165-bb30-a8de5cd4b21e` |
| Kristian Nielsen (NIE)    | yes      | `b7c17d71-ab5c-4a37-b0a6-fe8cc80887c5` | `531a6786-c0e2-401c-942c-6b32badd952f` |
| Sindre Haram (HAR)        | yes      | `48795c18-bace-4a2d-be67-1b209fe5b654` | `ce74089e-acd9-4ee2-8371-2599743edb17` |
| Sondre Kristensen (KRI)   | yes      | `8e97f7b6-4aa5-4c12-b364-e46ef4b0a695` | `dafe862c-f5ba-4df1-a526-6dd6e1d034ce` |
| Joppe Joppe (JOPE)        | yes      | `313dde00-aa9b-4c57-bd0d-af76f95db3c3` | `9fd9f016-e0a0-4578-99fa-694dfce4e3b9` |
| Axel Ericson (AXEL)       | yes      | `57723541-3f15-48c9-8c11-22b04b1735fd` | `bf237bda-c57f-4d30-83f9-4b5394f82b06` |
| Sebastian Pettersen (SEB) | yes      | `2d04152e-bc0a-4712-9c1d-4b387e2d7c83` | `96b46de6-0843-4b56-b19e-4c791ef466f5` |
| Sindre Sauarlia (SAU)     | yes      | `0d8450e9-15c2-4270-adf4-913f584a84f9` | `74f9c14d-5941-4e29-87fb-74e2ce8e4ca1` |
| Birk The skurk (BIRK)     | yes      | `1320b514-fa5c-8081-ae21-cf34f97a7bb5` | `e5d73d5c-de7d-454a-98ca-3ddcf6f50c4f` |
| Even Galåsen (GAL)        | yes      | `98db5c20-2526-4318-a4dd-ce2db8726cdd` | `cd6aa7cb-abdc-437a-9d64-19a88e800252` |
| Andreas Hundsnes (HUN)    | yes      | `feee5dc8-d7bd-41f8-966f-a64e77b7079b` | `5bc99ee7-6a49-477e-b151-814544682b75` |
| Kenneth Solvoll (KSO)     | yes      | `624ac48c-089b-4794-b6ac-5f091d8d640a` | `c740f8f7-175f-488d-a777-9eac4545ebbc` |
| Mikael Rodvelt (ROD)      | yes      | `c52a3f17-2b60-43be-96c5-219c3751fb23` | `a4b39b80-6ec3-42c8-938d-126083a590e2` |
| Fredrik Hyldmo (FHY)      | yes      | `93ad2385-2d34-4127-b4ea-f5a287de3717` | `5245769e-ba4f-4475-b704-6e2194b059e1` |
| Håkon Busk (HAWK)         | yes      | `e53a24cd-bbe4-4f33-9394-56303852efb7` | `caf40890-405f-4f7d-9b27-65bea22f22ff` |
| Johan Busk (BUS)          | yes      | `e282c223-58a4-4f66-9e9c-92bed56aa532` | `6b03591a-0a12-42e5-9678-c9c2947163fb` |
| Boye Wolla (WOL)          | yes      | `13bb8b6b-dae7-4533-8b46-883b73a66cf5` | `e4f5c071-8e2d-4d57-9f50-c1730c210757` |
| Erik Almåsvold (ERI)      | yes      | `5ff55487-ce53-4812-8e0e-282ef8c1bae5` | `81d8a60f-05b1-42a1-a315-d817e573e83e` |

## Track IDs used by these records

| Track ID                               | Number | Level | Type    |
| -------------------------------------- | ------ | ----- | ------- |
| `64772cfe-d982-476b-833e-4c97db144f9f` | 5      | white | drift   |
| `76d0d1ea-c971-464a-8bb0-9637e93b7b15` | 90     | blue  | drift   |
| `9427ae5d-ac7f-4c41-8515-594cf4a82b15` | 75     | green | stadium |

## Import notes

- Keep the PDF games as external results until a rebuilt bracket model can represent the grand final reset.
- The CSV fixture names are not unique. Use fixture, match, group, user, session, and track IDs to connect records.
- Four old quarterfinal match rows are cancelled placeholders; do not import them as completed knockout results.
- The deleted time entry and the separate completed HAR–AXEL match are intentionally retained with their original states.
