async function syncGenshinStats() {
    try {
        const enkaResponse = await axios.get(ENKA_URL);

        const player = enkaResponse.data.playerInfo;

        if (!player) {
            throw new Error("Player profile is private or not found.");
        }

        // Region formatting
        const regionMap = {
            os_asia: "Asia",
            os_euro: "Europe",
            os_usa: "America",
            os_cht: "TW/HK/MO"
        };

        const region =
            regionMap[enkaResponse.data.region] ??
            enkaResponse.data.region ??
            "Unknown";

        // Safe values
        const abyssFloor = player.towerFloorIndex ?? "-";
        const abyssLevel = player.towerLevelIndex ?? "-";
        const abyssStars = player.towerStarIndex ?? "-";

        const theaterAct = player.theaterActIndex;
        const theaterStars = player.theaterStarIndex;
        const theaterMode = player.theaterModeIndex;

        const stygianDiff = player.stygianIndex;
        const stygianTime = player.stygianSeconds;

        const signature =
            player.signature && player.signature.trim() !== ""
                ? `"${player.signature.substring(0, 60)}"`
                : "\"No signature\"";

        const payload = {
            username: player.nickname,
            data: {
                dynamic: [
                    { type: 1, name: "nickname", value: player.nickname },

                    {
                        type: 1,
                        name: "uid",
                        value: `UID ${process.env.GENSHIN_UID}`
                    },

                    {
                        type: 1,
                        name: "world",
                        value: `${region} • WL ${player.worldLevel ?? "-"}`
                    },

                    {
                        type: 1,
                        name: "adv_str",
                        value: "Adventure Rank"
                    },

                    {
                        type: 2,
                        name: "adv",
                        value: player.level ?? 0
                    },

                    {
                        type: 1,
                        name: "ach_str",
                        value: "Achievements"
                    },

                    {
                        type: 1,
                        name: "ach",
                        value: String(player.finishAchievementNum ?? "-")
                    },

                    {
                        type: 1,
                        name: "aby_str",
                        value: "Spiral Abyss"
                    },

                    {
                        type: 1,
                        name: "aby",
                        value: `${abyssFloor}-${abyssLevel} (${abyssStars}★)`
                    },

                    {
                        type: 1,
                        name: "img_str",
                        value: "Imaginarium Theatre"
                    },

                    {
                        type: 1,
                        name: "img",
                        value:
                            theaterAct != null
                                ? `Act ${theaterAct}${theaterMode === 104 ? "-2" : ""} (${theaterStars ?? "-"}★)`
                                : "Not Completed"
                    },

                    {
                        type: 1,
                        name: "sty_str",
                        value: "Stygian Onslaught"
                    },

                    {
                        type: 1,
                        name: "sty",
                        value:
                            stygianDiff != null
                                ? `Diff ${stygianDiff} • ${stygianTime ?? "-"}s`
                                : "Not Attempted"
                    },

                    {
                        type: 1,
                        name: "sig",
                        value: signature
                    },

                    {
                        type: 1,
                        name: "world_str",
                        value: "World Level"
                    },

                    {
                        type: 1,
                        name: "mini",
                        value: `${player.nickname}: AR ${player.level ?? "-"}`
                    }
                ]
            }
        };

        const discordApiUrl =
            `https://discord.com/api/v9/applications/${DISCORD_CLIENT_ID}` +
            `/users/${DISCORD_USER_ID}/identities/0/profile`;

        const response = await axios.patch(discordApiUrl, payload, {
            headers: {
                Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
                "Content-Type": "application/json"
            }
        });

        console.log(
            `✅ Successfully synced Genshin widget for ${player.nickname}. Status: ${response.status}`
        );
    } catch (error) {
        if (error.response) {
            console.error(
                "Discord API Error:",
                error.response.status,
                error.response.data
            );
        } else {
            console.error("Request Error:", error.message);
        }
    }
}