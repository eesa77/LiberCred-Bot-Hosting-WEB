require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'data.json');
const SYMBOL = '⎚';
const COLOR_GOLD = 0xFFD700;
const COLOR_RED = 0xFF4444;

function loadData() {
  if (!fs.existsSync(DATA_FILE)) {
    const initial = {
      balances: {},
      transactions: [],
      whitelist: { users: ['1509459953050583222'], roles: [] }
    };
    fs.writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    console.error('Failed to parse data.json:', e);
    process.exit(1);
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function isWhitelisted(userId, member, data) {
  if (data.whitelist.users.includes(userId)) return true;
  if (member && member.roles && member.roles.cache) {
    for (const roleId of data.whitelist.roles) {
      if (member.roles.cache.has(roleId)) return true;
    }
  }
  return false;
}

function getBalance(userId, data) {
  return data.balances[userId] || 0;
}

function addTransaction(data, type, fromId, toId, amount, note = '') {
  data.transactions.push({
    id: Date.now() + Math.random(),
    type,
    from: fromId,
    to: toId,
    amount,
    note,
    timestamp: new Date().toISOString()
  });
  if (data.transactions.length > 2000) {
    data.transactions = data.transactions.slice(-2000);
  }
}

const commands = [
  new SlashCommandBuilder()
    .setName('mint')
    .setDescription(`[Whitelist] Generate ${SYMBOL} LiberCred and give it to a user`)
    .addUserOption(o => o.setName('user').setDescription('Recipient').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount to mint').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder()
    .setName('burn')
    .setDescription(`[Whitelist] Remove ${SYMBOL} LiberCred from a user's balance`)
    .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount to burn').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder()
    .setName('balance')
    .setDescription(`View your own ${SYMBOL} LiberCred balance`),

  new SlashCommandBuilder()
    .setName('view')
    .setDescription(`View a user's ${SYMBOL} LiberCred balance (whitelist required for others)`)
    .addUserOption(o => o.setName('user').setDescription('User to view (leave blank for yourself)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('gift')
    .setDescription(`Give your own ${SYMBOL} LiberCred to someone`)
    .addUserOption(o => o.setName('user').setDescription('Recipient').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount to gift').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder()
    .setName('history')
    .setDescription(`View ${SYMBOL} transaction history (whitelist required for others)`)
    .addUserOption(o => o.setName('user').setDescription('User to check (leave blank for yourself)').setRequired(false))
    .addIntegerOption(o => o.setName('page').setDescription('Page number').setRequired(false).setMinValue(1)),

  new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription(`See the top ${SYMBOL} LiberCred holders`),

  new SlashCommandBuilder()
    .setName('stats')
    .setDescription(`View the ${SYMBOL} LiberCred economy statistics`),

  new SlashCommandBuilder()
    .setName('pay')
    .setDescription(`[Whitelist] Send ${SYMBOL} from one user to another`)
    .addUserOption(o => o.setName('from').setDescription('Sender').setRequired(true))
    .addUserOption(o => o.setName('to').setDescription('Recipient').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)),

  new SlashCommandBuilder()
    .setName('say')
    .setDescription('[Whitelist] Make the bot send a message')
    .addStringOption(o => o.setName('message').setDescription('Message to send').setRequired(true))
    .addChannelOption(o => o.setName('channel').setDescription('Channel to send in (defaults to current)').setRequired(false)),

  new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('[Whitelist] Manage the LiberCred whitelist')
    .addSubcommand(s => s.setName('add-user').setDescription('Add a user to the whitelist')
      .addUserOption(o => o.setName('user').setDescription('User to add').setRequired(true)))
    .addSubcommand(s => s.setName('remove-user').setDescription('Remove a user from the whitelist')
      .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true)))
    .addSubcommand(s => s.setName('add-role').setDescription('Add a role to the whitelist')
      .addRoleOption(o => o.setName('role').setDescription('Role to add').setRequired(true)))
    .addSubcommand(s => s.setName('remove-role').setDescription('Remove a role from the whitelist')
      .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true)))
    .addSubcommand(s => s.setName('list').setDescription('List all whitelisted users and roles')),
];

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

client.once('ready', async () => {
  console.log(`✅ LiberCred Bot is online as ${client.user.tag}`);
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log('Registering slash commands globally...');
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: commands.map(c => c.toJSON())
    });
    console.log('✅ Slash commands registered!');
  } catch (err) {
    console.error('Failed to register slash commands:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const data = loadData();
  const userId = interaction.user.id;
  const member = interaction.member;
  const wl = isWhitelisted(userId, member, data);

  try {
    switch (interaction.commandName) {

      case 'mint': {
        if (!wl) return interaction.reply({ content: `❌ You need whitelist access to mint ${SYMBOL} LiberCred.`, ephemeral: true });
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        data.balances[target.id] = getBalance(target.id, data) + amount;
        addTransaction(data, 'mint', 'SYSTEM', target.id, amount, `Minted by ${interaction.user.tag}`);
        saveData(data);
        return interaction.reply({ embeds: [
          new EmbedBuilder()
            .setColor(COLOR_GOLD)
            .setTitle(`${SYMBOL} LiberCred Minted`)
            .setDescription(`**${amount.toLocaleString()} ${SYMBOL}** minted for <@${target.id}>`)
            .addFields({ name: 'New Balance', value: `${getBalance(target.id, data).toLocaleString()} ${SYMBOL}`, inline: true })
            .setFooter({ text: `By ${interaction.user.tag}` })
            .setTimestamp()
        ]});
      }

      case 'burn': {
        if (!wl) return interaction.reply({ content: `❌ You need whitelist access to burn ${SYMBOL} LiberCred.`, ephemeral: true });
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const bal = getBalance(target.id, data);
        if (bal < amount) return interaction.reply({ content: `❌ <@${target.id}> only has **${bal.toLocaleString()} ${SYMBOL}**.`, ephemeral: true });
        data.balances[target.id] = bal - amount;
        addTransaction(data, 'burn', target.id, 'SYSTEM', amount, `Burned by ${interaction.user.tag}`);
        saveData(data);
        return interaction.reply({ embeds: [
          new EmbedBuilder()
            .setColor(COLOR_RED)
            .setTitle(`🔥 ${SYMBOL} LiberCred Burned`)
            .setDescription(`**${amount.toLocaleString()} ${SYMBOL}** removed from <@${target.id}>`)
            .addFields({ name: 'New Balance', value: `${data.balances[target.id].toLocaleString()} ${SYMBOL}`, inline: true })
            .setFooter({ text: `By ${interaction.user.tag}` })
            .setTimestamp()
        ]});
      }

      case 'balance': {
        const bal = getBalance(userId, data);
        return interaction.reply({ embeds: [
          new EmbedBuilder()
            .setColor(COLOR_GOLD)
            .setTitle(`${SYMBOL} Your LiberCred Balance`)
            .setDescription(`**${bal.toLocaleString()} ${SYMBOL}**`)
            .setFooter({ text: interaction.user.tag })
            .setTimestamp()
        ], ephemeral: true });
      }

      case 'view': {
        const target = interaction.options.getUser('user');
        if (target && target.id !== userId && !wl) {
          return interaction.reply({ content: `❌ You need whitelist access to view others' balances.`, ephemeral: true });
        }
        const viewUser = target || interaction.user;
        const bal = getBalance(viewUser.id, data);
        return interaction.reply({ embeds: [
          new EmbedBuilder()
            .setColor(COLOR_GOLD)
            .setTitle(`${SYMBOL} LiberCred Balance`)
            .setDescription(`<@${viewUser.id}>`)
            .addFields({ name: 'Balance', value: `**${bal.toLocaleString()} ${SYMBOL}**`, inline: true })
            .setTimestamp()
        ], ephemeral: !wl });
      }

      case 'gift': {
        const target = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        if (target.id === userId) return interaction.reply({ content: `❌ You can't gift ${SYMBOL} to yourself.`, ephemeral: true });
        if (target.bot) return interaction.reply({ content: `❌ You can't gift ${SYMBOL} to a bot.`, ephemeral: true });
        const senderBal = getBalance(userId, data);
        if (senderBal < amount) {
          return interaction.reply({ content: `❌ Insufficient balance. You have **${senderBal.toLocaleString()} ${SYMBOL}**.`, ephemeral: true });
        }
        data.balances[userId] = senderBal - amount;
        data.balances[target.id] = getBalance(target.id, data) + amount;
        addTransaction(data, 'gift', userId, target.id, amount);
        saveData(data);
        return interaction.reply({ embeds: [
          new EmbedBuilder()
            .setColor(COLOR_GOLD)
            .setTitle(`${SYMBOL} LiberCred Gifted!`)
            .setDescription(`<@${userId}> gifted **${amount.toLocaleString()} ${SYMBOL}** to <@${target.id}>!`)
            .addFields(
              { name: 'Your New Balance', value: `${data.balances[userId].toLocaleString()} ${SYMBOL}`, inline: true },
              { name: `Their New Balance`, value: `${data.balances[target.id].toLocaleString()} ${SYMBOL}`, inline: true }
            )
            .setTimestamp()
        ]});
      }

      case 'pay': {
        if (!wl) return interaction.reply({ content: `❌ You need whitelist access to use /pay.`, ephemeral: true });
        const from = interaction.options.getUser('from');
        const to = interaction.options.getUser('to');
        const amount = interaction.options.getInteger('amount');
        if (from.id === to.id) return interaction.reply({ content: `❌ From and to cannot be the same user.`, ephemeral: true });
        const fromBal = getBalance(from.id, data);
        if (fromBal < amount) {
          return interaction.reply({ content: `❌ <@${from.id}> only has **${fromBal.toLocaleString()} ${SYMBOL}**.`, ephemeral: true });
        }
        data.balances[from.id] = fromBal - amount;
        data.balances[to.id] = getBalance(to.id, data) + amount;
        addTransaction(data, 'pay', from.id, to.id, amount, `Admin transfer by ${interaction.user.tag}`);
        saveData(data);
        return interaction.reply({ embeds: [
          new EmbedBuilder()
            .setColor(COLOR_GOLD)
            .setTitle(`${SYMBOL} LiberCred Transfer`)
            .setDescription(`**${amount.toLocaleString()} ${SYMBOL}** transferred from <@${from.id}> to <@${to.id}>`)
            .addFields(
              { name: `${from.username}'s Balance`, value: `${data.balances[from.id].toLocaleString()} ${SYMBOL}`, inline: true },
              { name: `${to.username}'s Balance`, value: `${data.balances[to.id].toLocaleString()} ${SYMBOL}`, inline: true }
            )
            .setFooter({ text: `Admin transfer by ${interaction.user.tag}` })
            .setTimestamp()
        ]});
      }

      case 'history': {
        const target = interaction.options.getUser('user');
        const page = Math.max(1, interaction.options.getInteger('page') || 1);
        if (target && target.id !== userId && !wl) {
          return interaction.reply({ content: `❌ You need whitelist access to view others' history.`, ephemeral: true });
        }
        const viewUser = target || interaction.user;
        const userTxns = data.transactions
          .filter(t => t.from === viewUser.id || t.to === viewUser.id)
          .reverse();
        const perPage = 10;
        const totalPages = Math.max(1, Math.ceil(userTxns.length / perPage));
        const slice = userTxns.slice((page - 1) * perPage, page * perPage);
        if (slice.length === 0) {
          return interaction.reply({ content: `No transactions found for <@${viewUser.id}>.`, ephemeral: true });
        }
        const lines = slice.map(t => {
          const date = new Date(t.timestamp).toLocaleDateString();
          if (t.type === 'mint') return `📥 **+${t.amount.toLocaleString()} ${SYMBOL}** minted (${date})`;
          if (t.type === 'burn') return `🔥 **-${t.amount.toLocaleString()} ${SYMBOL}** burned (${date})`;
          if (t.type === 'pay') {
            if (t.from === viewUser.id) return `📤 **-${t.amount.toLocaleString()} ${SYMBOL}** admin sent to <@${t.to}> (${date})`;
            return `📥 **+${t.amount.toLocaleString()} ${SYMBOL}** admin received from <@${t.from}> (${date})`;
          }
          if (t.from === viewUser.id) return `📤 **-${t.amount.toLocaleString()} ${SYMBOL}** gifted to <@${t.to}> (${date})`;
          return `📥 **+${t.amount.toLocaleString()} ${SYMBOL}** received from <@${t.from}> (${date})`;
        });
        return interaction.reply({ embeds: [
          new EmbedBuilder()
            .setColor(COLOR_GOLD)
            .setTitle(`${SYMBOL} History — ${viewUser.username}`)
            .setDescription(lines.join('\n'))
            .setFooter({ text: `Page ${page}/${totalPages} • Balance: ${getBalance(viewUser.id, data).toLocaleString()} ${SYMBOL}` })
            .setTimestamp()
        ], ephemeral: true });
      }

      case 'leaderboard': {
        const sorted = Object.entries(data.balances)
          .filter(([, v]) => v > 0)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10);
        if (sorted.length === 0) {
          return interaction.reply({ content: `No ${SYMBOL} LiberCred has been minted yet!`, ephemeral: true });
        }
        const medals = ['🥇', '🥈', '🥉'];
        const lines = sorted.map(([id, bal], i) => `${medals[i] || `**${i + 1}.**`} <@${id}> — **${bal.toLocaleString()} ${SYMBOL}**`);
        return interaction.reply({ embeds: [
          new EmbedBuilder()
            .setColor(COLOR_GOLD)
            .setTitle(`${SYMBOL} LiberCred Leaderboard`)
            .setDescription(lines.join('\n'))
            .setTimestamp()
        ]});
      }

      case 'stats': {
        const totalSupply = Object.values(data.balances).reduce((a, b) => a + b, 0);
        const holders = Object.values(data.balances).filter(b => b > 0).length;
        const minted = data.transactions.filter(t => t.type === 'mint').reduce((a, t) => a + t.amount, 0);
        const burned = data.transactions.filter(t => t.type === 'burn').reduce((a, t) => a + t.amount, 0);
        return interaction.reply({ embeds: [
          new EmbedBuilder()
            .setColor(COLOR_GOLD)
            .setTitle(`${SYMBOL} LiberCred Economy Stats`)
            .addFields(
              { name: 'Circulating Supply', value: `${totalSupply.toLocaleString()} ${SYMBOL}`, inline: true },
              { name: 'Holders', value: `${holders}`, inline: true },
              { name: 'Total Transactions', value: `${data.transactions.length.toLocaleString()}`, inline: true },
              { name: 'Total Minted', value: `${minted.toLocaleString()} ${SYMBOL}`, inline: true },
              { name: 'Total Burned', value: `${burned.toLocaleString()} ${SYMBOL}`, inline: true }
            )
            .setTimestamp()
        ]});
      }

      case 'say': {
        if (!wl) return interaction.reply({ content: `❌ You need whitelist access to use /say.`, ephemeral: true });
        const message = interaction.options.getString('message');
        const channel = interaction.options.getChannel('channel') || interaction.channel;
        await channel.send(message);
        return interaction.reply({ content: '✅ Sent!', ephemeral: true });
      }

      case 'whitelist': {
        if (!wl) return interaction.reply({ content: `❌ You need whitelist access to manage the whitelist.`, ephemeral: true });
        const sub = interaction.options.getSubcommand();

        if (sub === 'add-user') {
          const target = interaction.options.getUser('user');
          if (data.whitelist.users.includes(target.id)) return interaction.reply({ content: `<@${target.id}> is already whitelisted.`, ephemeral: true });
          data.whitelist.users.push(target.id);
          saveData(data);
          return interaction.reply({ content: `✅ <@${target.id}> added to the whitelist.`, ephemeral: true });
        }
        if (sub === 'remove-user') {
          const target = interaction.options.getUser('user');
          data.whitelist.users = data.whitelist.users.filter(id => id !== target.id);
          saveData(data);
          return interaction.reply({ content: `✅ <@${target.id}> removed from the whitelist.`, ephemeral: true });
        }
        if (sub === 'add-role') {
          const role = interaction.options.getRole('role');
          if (data.whitelist.roles.includes(role.id)) return interaction.reply({ content: `<@&${role.id}> is already whitelisted.`, ephemeral: true });
          data.whitelist.roles.push(role.id);
          saveData(data);
          return interaction.reply({ content: `✅ <@&${role.id}> added to the whitelist.`, ephemeral: true });
        }
        if (sub === 'remove-role') {
          const role = interaction.options.getRole('role');
          data.whitelist.roles = data.whitelist.roles.filter(id => id !== role.id);
          saveData(data);
          return interaction.reply({ content: `✅ <@&${role.id}> removed from the whitelist.`, ephemeral: true });
        }
        if (sub === 'list') {
          const userMentions = data.whitelist.users.length ? data.whitelist.users.map(id => `<@${id}>`).join(', ') : 'None';
          const roleMentions = data.whitelist.roles.length ? data.whitelist.roles.map(id => `<@&${id}>`).join(', ') : 'None';
          return interaction.reply({ embeds: [
            new EmbedBuilder()
              .setColor(COLOR_GOLD)
              .setTitle(`${SYMBOL} LiberCred Whitelist`)
              .addFields(
                { name: 'Whitelisted Users', value: userMentions },
                { name: 'Whitelisted Roles', value: roleMentions }
              )
              .setTimestamp()
          ], ephemeral: true });
        }
        break;
      }
    }
  } catch (err) {
    console.error(`Error in /${interaction.commandName}:`, err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ An error occurred. Please try again.', ephemeral: true });
    }
  }
});

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN is not set. Please add it to your Replit Secrets.');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
