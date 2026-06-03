# LiberCred Bot

A Discord bot that manages the **LiberCred (⎚)** digital currency economy.

## Running the Bot

Start with: `npm start`

Requires the `DISCORD_TOKEN` secret to be set in Replit Secrets.

## Commands

| Command | Description | Whitelist Required |
|---|---|---|
| `/mint` | Generate ⎚ and give to a user | ✅ Yes |
| `/burn` | Remove ⎚ from a user's balance | ✅ Yes |
| `/view` | View anyone's balance | ✅ For others |
| `/balance` | View your own balance | ❌ No |
| `/gift` | Give your own ⎚ to someone | ❌ No |
| `/history` | View transaction history | ✅ For others |
| `/leaderboard` | See top ⎚ holders | ❌ No |
| `/stats` | Economy overview (supply, holders, txns) | ❌ No |
| `/whitelist` | Manage whitelist users & roles | ✅ Yes |

## Data Persistence

All balances, transactions, and whitelist data are stored in `data.json`.  
This file is **never reset** when the bot code is updated.

## User Preferences

- Owner user ID (pre-whitelisted): `1509459953050583222`
