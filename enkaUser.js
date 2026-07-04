if (process.env.GITHUB_ACTIONS !== "true") {
    require("dotenv").config();
}
const axios = require('axios');

const ENKA_URL = `https://enka.network/api/uid/${process.env.GENSHIN_UID}?info`;

// Official Enka mappings (maintained by Enka.Network, auto-updates for new characters)
const CHARACTERS_MAP_URL = "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/characters.json";
const PFPS_MAP_URL = "https://raw.githubusercontent.com/EnkaNetwork/API-docs/master/store/pfps.json";
const ENKA_UI_BASE = "https://enka.network/ui/";

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID; 
const DISCORD_USER_ID = process.env.DISCORD_USER_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN; 

// How often the displayed character rotates (in hours).
// Should match (or be a multiple of) the GitHub Actions cron schedule.
const ROTATE_HOURS = Number(process.env.ROTATE_HOURS ?? 6);

// =====================
// CHARACTER IMAGE
// =====================
async function getCharacterImageUrl(player) {
    try {
        // Rotate through the showcase: pick a different character every ROTATE_HOURS.
        // Time-based, so no state file is needed — each scheduled run lands on the next slot.
        const showcase = player.showAvatarInfoList ?? [];
        let showcased = null;

        if (showcase.length > 0) {
            const rotationIndex =
                Math.floor(Date.now() / (ROTATE_HOURS * 3600 * 1000)) % showcase.length;
            showcased = showcase[rotationIndex];
            console.log(
                `🔄 Rotation: slot ${rotationIndex + 1}/${showcase.length} (changes every ${ROTATE_HOURS}h)`
            );
        }

        if (showcased) {
            const { data: characters } = await axios.get(CHARACTERS_MAP_URL, { timeout: 10000 });

            // Traveler needs the skillDepot suffix (e.g. "10000007-704"),
            // normal characters are just the avatarId.
            const key =
                showcased.avatarId >= 10000005 && showcased.avatarId <= 10000007 && showcased.skillDepotId
                    ? `${showcased.avatarId}-${showcased.skillDepotId}`
                    : String(showcased.avatarId);

            const charData = characters[key] ?? characters[String(showcased.avatarId)];

            if (charData) {
                // Costume icon if one is equipped, otherwise the default icon
                let iconName = null;

                if (showcased.costumeId && charData.Costumes?.[showcased.costumeId]?.icon) {
                    iconName = charData.Costumes[showcased.costumeId].icon;
                } else if (charData.SideIconName) {
                    // "UI_AvatarIcon_Side_Kachina" -> "UI_AvatarIcon_Kachina"
                    iconName = charData.SideIconName.replace("_Side", "");
                }

                if (iconName) {
                    return `${ENKA_UI_BASE}${iconName}.png`;
                }
            }
        }

        // Fallback: the player's in-game profile picture
        const pfpId = player.profilePicture?.id;
        if (pfpId) {
            const { data: pfps } = await axios.get(PFPS_MAP_URL, { timeout: 10000 });
            const iconPath = pfps[String(pfpId)]?.iconPath;
            if (iconPath) {
                return `${ENKA_UI_BASE}${iconPath}.png`;
            }
        }

        return null;
    } catch (err) {
        console.warn("⚠️ Could not resolve character image:", err.message);
        return null;
    }
}

async function syncGenshinStats() {
    try {
        const enkaResponse = await axios.get(ENKA_URL, { timeout: 10000 });

        const player = enkaResponse.data.playerInfo;

        if (!player) {
            throw new Error("Player profile is private or not found.");
        }

        // Region formatting
        const regionMap = {
            os_asia: "Asia",
            os_euro: "Europe",
            os_usa: "America",
            os_cht: "TW/HK/MO",
            ASIA: "Asia",
            EURO: "Europe",
            USA: "America",
            CHT: "TW/HK/MO"
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

        // Resolve the showcased character's image
        const imageUrl = await getCharacterImageUrl(player);
        if (imageUrl) {
            console.log(`🖼️ Character image: ${imageUrl}`);
        } else {
            console.log("🖼️ No character image found (empty showcase?)");
        }

        const dynamic = [
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
        ];

        // Only add the image field if we actually resolved one
        // (same pattern as the Last.fm widget's album_art)
        if (imageUrl) {
            dynamic.push({
                type: 3,
                name: "image",
                value: {
                    url: imageUrl
                }
            });
        }

        const payload = { data: { dynamic } };

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
            process.exit(1);
        } else {
            console.error("Request Error:", error.message);
            process.exit(1);
        }
    }
}

syncGenshinStats();
