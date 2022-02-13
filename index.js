require("dotenv").config();
const { Client, MessageEmbed, Permissions, Collection } = require("discord.js");
const Guild = require("./models/Guild");
const fs = require("fs");

// Async Node Fetch
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

// Discord Client Connection
const client = new Client({
  intents: ["GUILDS", "GUILD_MEMBERS", "GUILD_MESSAGES"],
  allowedMentions: { parse: ["roles", "users"], repliedUser: true },
  partials: ["CHANNEL", "GUILD_MEMBER", "MESSAGE", "USER"],
});
global.Guild = require("./models/Guild");

// Command Files
client.commands = new Collection();
const commandFiles = fs
  .readdirSync("./helpers/Commands")
  .filter((file) => file.endsWith(".js"));
for (const file of commandFiles) {
  const command = require(`./helpers/Commands/${file}`);
  client.commands.set(command.data.name, command);
}

// Requires
require("./helpers/Requires/ksoft")(client);
require("./helpers/Requires/database")(client);

const domainsDatabase = ["https://get.estn.io"];

// Domain Funcs
function domain_from_url(url) {
  var result;
  var match;
  if (
    (match = url.match(
      /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:\/\n\?\=]+)/im
    ))
  ) {
    result = match[1];
    if ((match = result.match(/^[^\.]+\.(.+\..+)$/))) {
      result = match[1];
    }
  }
  return result;
}

// SendLogs Func
const sendLogs = async function async(
  userID,
  username,
  link,
  channelID,
  message,
  url,
  database
) {
  const guildInfo = await Guild.findOne({ guildID: message.guild.id });
  const loggingChannel = guildInfo.loggingChannel; // DB Pulls Logs Channel Here

  url = domain_from_url(url);
  if (url === null) {
  } else {
    vtURL = `https://www.virustotal.com/gui/domain/${url}`;
  } // Check If URL Data Exists

  if (guildInfo.logs === true) {
    const channel = client.channels.cache.get(loggingChannel); // Logs Channel ID

    let previousBans = await client.ksoft.bans.check(message.member.id);
    let BannedInfo = await client.ksoft.bans.info(message.member.id);

    if (previousBans == true) {
      const prettyJs = require("pretty-js");
      previousBans = `Global Server Check: This User Has Prevoius Server Ban History\n${prettyJs(
        JSON.stringify(BannedInfo)
      )}`;
    } else {
      previousBans = "Global Server Check: No Past Ban History";
    }

    const embed = new MessageEmbed()
      .setTitle(`ID: ${userID} :: AI Detection Alert`)
      .setURL(vtURL || null)
      .addField("UserID:", userID, false)
      .addField("User:", `<@${userID}>`, false)
      .addField("Message:", link, false)
      .addField("Link:", url, false)
      .addField("Channel ID:", channelID, false)
      .addField("Channel URL:", message.url, false)
      .addField("Database:", database || "AI Detection", false)
      .addField("Banned In Previous Servers:", previousBans, false)
      .setThumbnail(message.author.avatarURL())
      .setTimestamp()
      .setFooter({
        text: "Detection Algorithm Version: 1.1-STABLE",
        iconURL: message.guild.iconURL(),
      })
      .setAuthor({
        name: `Click Here For ${message.author.username}'s Profile`,
        iconURL: message.author.avatarURL(),
        url: `https://discordrep.com/u/${userID}`,
      })
      .setColor("DARK_GOLD");
    channel.send({ embeds: [embed] });
  }
};

client.once("ready", () => {
  console.log(`[ API ] Logged in as ${client.user.tag}`);

  console.log(
    `The Bot Has Booted Up & Is Ready For Protection! (${client.users.size} | ${client.users.cache.size}`
  );
  setTimeout(() => {
    client.user.setActivity(
      `ProtectAI | ${
        client.guilds.cache.size
      } Servers | ${client.guilds.cache.reduce(
        (acc, guild) => acc + guild.memberCount,
        0
      )} Users`,
      {
        type: "WATCHING",
      },
      50000
    );
  });
});

client.on("interactionCreate", async (interaction) => {
  if (!interaction.isCommand()) return;
  if (!interaction.member.permissions.has(Permissions.FLAGS.MANAGE_MESSAGES))
    return;

  const command = client.commands.get(interaction.commandName);

  const { commandName } = interaction;

  const guildInfo = await Guild.findOne({ guildID: interaction.guild.id });
  if (!guildInfo) {
    const newG = new Guild({ guildID: interaction.guild.id });
    newG.save();
  }

  if (!command) return;
  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(error);
    await interaction.reply({
      content: "There was an error while executing this command!",
      ephemeral: true,
    });
  }

  if (commandName === "nitroscam") {
    await global.Guild.updateOne({ nitroScams: true });
    await interaction.reply(
      "Nitro Scam Detection Enabled, All Free Nitro Scams Will Be Removed!"
    );
  } else if (commandName === "nitroscamoff") {
    await global.Guild.updateOne({ nitroScams: false });
    await interaction.reply(
      "Nitro Scam Detection Disabled, All Free Nitro Scams Will Not Be Removed!"
    );
  }
});

client.on("messageCreate", async (message) => {
  if (!message) return;
  if (message.author.bot) return;
  if (!message.guild) return;
  const messageUpper = message.content.toUpperCase();

  const guildInfo = await Guild.findOne({ guildID: message.guild.id });

  if (!guildInfo) {
    const newG = new Guild({ guildID: message.guild.id });
    newG.save();
  }

  if (guildInfo.protection === true) {
    domainsDatabase.forEach((domain) => {
      if (message.content.includes(domain)) {
        message.delete();
      } else {
        return;
      }
    });
  }

  if (guildInfo.protection === true) {
    const matches = message.content.match(/\bhttps?:\/\/\S+/gi);
    if (matches) {
      matches.forEach(async function (matches) {
        const url = domain_from_url(matches.toString());

        const response = await fetch(
          `https://phish.sinking.yachts/v2/check/${url}`,
          {
            method: "GET",
          }
        );
        const body = await response.text();

        if (body == "true" || body == true) {
          await message.delete();
          const embed = new MessageEmbed()
            .setTitle(":x: Phising Link Detected!")
            .setAuthor({
              name: `Sent By: ${message.author.username}`,
              iconURL: message.author.avatarURL(),
            })
            .setDescription(
              `**Type:** Phishing Link\n**Purpose:** This Link Is Used For An Attacker to Gain Access To Your Account.\n**Link Details:**\n**URL Scan:** https://www.virustotal.com/gui/domain/${url}\n**Database:** https://phish.sinking.yachts/`
            )
            .setImage("")
            .setTimestamp()
            .setColor("#2C2F33");
          await message.channel
            .send({ embeds: [embed] })
            .then((msg) => {
              setTimeout(() => msg.delete(), 60000);
            })
            .catch();
          sendLogs(
            message.member.id,
            message.member.username,
            message.content,
            message.channel.id,
            message,
            url,
            "https://phish.sinking.yachts/"
          );
          return;
        }
      });
    }
  }

  if (guildInfo.protection === true) {
    if (
      message.content.match(
        /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im
      ) == true
    ) {
      //message.send("Phone Number (US)")
      console.log("Phone Number (US)");
    }

    if (
      message.content.match(/^[+]*[(]{0,1}[0-9]{1,3}[)]{0,1}[-\s\./0-9]*$/g) ==
      true
    ) {
      //message.send("Phone Number (UK)")
      console.log("Phone Number (UK)");
    }
  }

  if (guildInfo.protection === true) {
    if (
      message.content.includes("@here") ||
      message.content.includes("@everyone")
    ) {
      if (message.member.permissions.has(Permissions.FLAGS.MANAGE_MESSAGES))
        return;
      await message.delete();
      await message.channel
        .send(
          "Sorry you dont have Permission to mention `@here` or `@everyone`!"
        )
        .then((msg) => {
          setTimeout(() => msg.delete(), 60000);
        })
        .catch();
      sendLogs(
        message.member.id,
        message.member.username,
        message.content,
        message.channel.id,
        message
      );
    }
  }

  if (guildInfo.protection === true) {
    if (
      message.content.includes("http://") ||
      message.content.includes("https://")
    ) {
      if (message.content.includes(".ru/") || message.content.includes(".ru")) {
        if (guildInfo.russianLinks === true) {
          await message.delete();
          const embed = new MessageEmbed()
            .setTitle(":x: Russian Link Detected!")
            .setDescription(
              `**Type:** Russian Link\n**Purpose:** This Link Is Used For An Attacker to Gain Access To Your Account.\n**Link Details:**\n**URL Scan:** Coming Soon!`
            )
            .setTimestamp()
            .setColor("#2C2F33");
          await message.channel
            .send({ embeds: [embed] })
            .then((msg) => {
              setTimeout(() => msg.delete(), 60000);
            })
            .catch();
          sendLogs(
            message.member.id,
            message.member.username,
            message.content,
            message.channel.id,
            message
          );
        }
      } else if (
        messageUpper.includes("FREENITRO") ||
        messageUpper.includes("FREE NITRO")
      ) {
        if (guildInfo.nitroScams === true) {
          await message.delete();
          const embed = new MessageEmbed()
            .setTitle(":x: Phising Link Detected!")
            .setDescription(
              `**Type:** Discord Phishing Link\n**Purpose:** This Link Is Used For An Attacker to Gain Access To Your Account.\n**Link Details:**\n**URL Scan:** Coming Soon!`
            )
            .setTimestamp()
            .setColor("#2C2F33");
          await message.channel
            .send({ embeds: [embed] })
            .then((msg) => {
              setTimeout(() => msg.delete(), 60000);
            })
            .catch();
          sendLogs(
            message.member.id,
            message.member.username,
            message.content,
            message.channel.id,
            message
          );
        }
      } else if (message.content.includes("discorcl.org")) {
        if (guildInfo.russianLinks === true) {
          await message.delete();
          await message.channel
            .send(
              "Sorry, This Link Has Been Detected As Malicious. Please Do Not Advertise Malicious Links! :octagonal_sign:"
            )
            .then((msg) => {
              setTimeout(() => msg.delete(), 60000);
            })
            .catch();
          sendLogs(
            message.member.id,
            message.member.username,
            message.content,
            message.channel.id,
            message
          );
        }
      } else if (message.content.includes(".ru")) {
        await message.delete();
        await message.channel
          .send("Sorry, No Russian Links Allowed :octagonal_sign:")
          .then((msg) => {
            setTimeout(() => msg.delete(), 60000);
          })
          .catch();
        sendLogs(
          message.member.id,
          message.member.username,
          message.content,
          message.channel.id,
          message
        );
      } else if (message.content.includes(".ngrok.io")) {
        await message.delete();
        await message.channel
          .send("Sorry, No Kali Linux Phishing Sites Allowed :octagonal_sign:")
          .then((msg) => {
            setTimeout(() => msg.delete(), 60000);
          })
          .catch();
        sendLogs(
          message.member.id,
          message.member.username,
          message.content,
          message.channel.id,
          message
        );
      } else if (
        message.content.includes("steamcommunitya") ||
        message.content.includes("steamcomrrnunity")
      ) {
        await message.delete();
        await message.channel
          .send("Sorry, No Steam Phishing Sites Allowed :octagonal_sign:")
          .then((msg) => {
            setTimeout(() => msg.delete(), 60000);
          })
          .catch();
        sendLogs(
          message.member.id,
          message.member.username,
          message.content,
          message.channel.id,
          message
        );
      } else if (message.content.includes("discordrgift")) {
        if (guildInfo.nitroScams === true) {
          await message.delete();
          const embed = new MessageEmbed()
            .setTitle(":x: Nitro Phishing Link Detected!")
            .setDescription(
              `**Type:** Discord Phishing Link\n**Purpose:** This Link Is Used For An Attacker to Gain Access To Your Account.\n**Link Details:**\n**URL Scan:** Coming Soon!`
            )
            .setTimestamp()
            .setColor("#2C2F33");
          await message.channel
            .send({ embeds: [embed] })
            .then((msg) => {
              setTimeout(() => msg.delete(), 60000);
            })
            .catch();
          sendLogs(
            message.member.id,
            message.member.username,
            message.content,
            message.channel.id,
            message
          );
        }
      } else if (
        messageUpper.includes("FREE") &&
        messageUpper.includes("NITRO") &&
        messageUpper.includes("GIFT")
      ) {
        if (guildInfo.nitroScams === true) {
          await message.delete();
          const embed = new MessageEmbed()
            .setTitle(":x: Phising Link Detected!")
            .setDescription(
              `**Type:** Discord Phishing Link\n**Purpose:** This Link Is Used For An Attacker to Gain Access To Your Account.\n**Link Details:**\n**URL Scan:** Coming Soon!`
            )
            .setTimestamp()
            .setColor("#2C2F33");
          await message.channel
            .send({ embeds: [embed] })
            .then((msg) => {
              setTimeout(() => msg.delete(), 60000);
            })
            .catch();
          sendLogs(
            message.member.id,
            message.member.username,
            message.content,
            message.channel.id,
            message
          );
        }
      } else if (
        messageUpper.includes("FREE") &&
        messageUpper.includes("NITRO")
      ) {
        if (guildInfo.nitroScams === true) {
          await message.delete();
          const embed = new MessageEmbed()
            .setTitle(":x: Phising Link Detected!")
            .setDescription(
              `**Type:** Discord Phishing Link\n**Purpose:** This Link Is Used For An Attacker to Gain Access To Your Account.\n**Link Details:**\n**URL Scan:** Coming Soon!`
            )
            .setTimestamp()
            .setColor("#2C2F33");
          await message.channel
            .send({ embeds: [embed] })
            .then((msg) => {
              setTimeout(() => msg.delete(), 60000);
            })
            .catch();
          sendLogs(
            message.member.id,
            message.member.username,
            message.content,
            message.channel.id,
            message
          );
        }
      } else if (
        messageUpper.includes("GIFT") &&
        messageUpper.includes("NITRO")
      ) {
        if (guildInfo.nitroScams === true) {
          await message.delete();
          const embed = new MessageEmbed()
            .setTitle(":x: Phising Link Detected!")
            .setDescription(
              `**Type:** Discord Phishing Link\n**Purpose:** This Link Is Used For An Attacker to Gain Access To Your Account.\n**Link Details:**\n**URL Scan:** Coming Soon!`
            )
            .setTimestamp()
            .setColor("#2C2F33");
          await message.channel
            .send({ embeds: [embed] })
            .then((msg) => {
              setTimeout(() => msg.delete(), 60000);
            })
            .catch();
          sendLogs(
            message.member.id,
            message.member.username,
            message.content,
            message.channel.id,
            message
          );
        }
      }
    } else if (
      messageUpper.includes("FREENITRO") ||
      messageUpper.includes("FREE NITRO")
    ) {
      if (guildInfo.nitroScams === true) {
        await message.delete();
        const embed = new MessageEmbed()
          .setTitle(":x: Phising Link Detected!")
          .setDescription(
            `**Type:** Discord Phishing Link\n**Purpose:** This Link Is Used For An Attacker to Gain Access To Your Account.\n**Link Details:**\n**URL Scan:** Coming Soon!`
          )
          .setTimestamp()
          .setColor("#2C2F33");
        await message.channel
          .send({ embeds: [embed] })
          .then((msg) => {
            setTimeout(() => msg.delete(), 60000);
          })
          .catch();
        sendLogs(
          message.member.id,
          message.member.username,
          message.content,
          message.channel.id,
          message
        );
      }
    } else if (message.content.includes(".ru")) {
      if (guildInfo.russianLinks === true) {
        await message.delete();
        await message.channel
          .send("Sorry, No Russian Links Allowed :octagonal_sign:")
          .then((msg) => {
            setTimeout(() => msg.delete(), 60000);
          })
          .catch();
        sendLogs(
          message.member.id,
          message.member.username,
          message.content,
          message.channel.id,
          message
        );
      }
    } else if (message.content.includes(".ngrok.io")) {
      await message.delete();
      await message.channel
        .send("Sorry, No Kali Linux Phishing Sites Allowed :octagonal_sign:")
        .then((msg) => {
          setTimeout(() => msg.delete(), 60000);
        })
        .catch();
      sendLogs(
        message.member.id,
        message.member.username,
        message.content,
        message.channel.id,
        message
      );
    } else if (
      message.content.includes("steamcommunitya") ||
      message.content.includes("steamcomrrnunity")
    ) {
      await message.delete();
      await message.channel
        .send("Sorry, No Steam Phishing Sites Allowed :octagonal_sign:")
        .then((msg) => {
          setTimeout(() => msg.delete(), 60000);
        })
        .catch();
      sendLogs(
        message.member.id,
        message.member.username,
        message.content,
        message.channel.id,
        message
      );
    } else if (
      messageUpper.includes("FREE") &&
      messageUpper.includes("NITRO") &&
      messageUpper.includes("GIFT")
    ) {
      if (guildInfo.nitroScams === true) {
        await message.delete();
        const embed = new MessageEmbed()
          .setTitle(":x: Phising Link Detected!")
          .setDescription(
            `**Type:** Discord Phishing Link\n**Purpose:** This Link Is Used For An Attacker to Gain Access To Your Account.\n**Link Details:**\n**URL Scan:** Coming Soon!`
          )
          .setTimestamp()
          .setColor("#2C2F33");
        await message.channel
          .send({ embeds: [embed] })
          .then((msg) => {
            setTimeout(() => msg.delete(), 60000);
          })
          .catch();
        sendLogs(
          message.member.id,
          message.member.username,
          message.content,
          message.channel.id,
          message
        );
      } else if (
        messageUpper.includes("FREE") &&
        messageUpper.includes("DISCORD") &&
        messageUpper.includes("NITRO")
      ) {
        if (guildInfo.nitroScams === true) {
          await message.delete();
          const embed = new MessageEmbed()
            .setTitle(":x: Phising Link Detected!")
            .setDescription(
              `**Type:** Discord Phishing Link\n**Purpose:** This Link Is Used For An Attacker to Gain Access To Your Account.\n**Link Details:**\n**URL Scan:** Coming Soon!`
            )
            .setTimestamp()
            .setColor("#2C2F33");
          await message.channel
            .send({ embeds: [embed] })
            .then((msg) => {
              setTimeout(() => msg.delete(), 60000);
            })
            .catch();
          sendLogs(
            message.member.id,
            message.member.username,
            message.content,
            message.channel.id,
            message
          );
        }
      } else if (
        messageUpper.includes("FREE") &&
        messageUpper.includes("NITRO")
      ) {
        if (guildInfo.nitroScams === true) {
          await message.delete();
          const embed = new MessageEmbed()
            .setTitle(":x: Phising Link Detected!")
            .setDescription(
              `**Type:** Discord Phishing Link\n**Purpose:** This Link Is Used For An Attacker to Gain Access To Your Account.\n**Link Details:**\n**URL Scan:** Coming Soon!`
            )
            .setTimestamp()
            .setColor("#2C2F33");
          await message.channel
            .send({ embeds: [embed] })
            .then((msg) => {
              setTimeout(() => msg.delete(), 60000);
            })
            .catch();
          sendLogs(
            message.member.id,
            message.member.username,
            message.content,
            message.channel.id,
            message
          );
        }
      }
    }
  }
});

client
  .login(process.env.TOKEN)
  .then(() => {
    console.log("[ API ] Discord API Login Channel Success");
  })
  .catch((err) => {
    console.error(err);
  });
