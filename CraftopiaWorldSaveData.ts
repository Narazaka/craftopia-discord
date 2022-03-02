export interface CraftopiaWorldSaveData {
    WorldSave: {
        value: {
            name: string;
            worldLevel: number;
            latestHour: number;
            latestDay: number;
            supplyPodTimer: number;
            supplyPodInterval: number;
            openFirstVillage: boolean;
            openFirstSpring: boolean;
            openFirstEmpty: boolean;
            openFirstAutumn: boolean;
            openFirstHell: boolean;
            openFirstPoison: boolean;
            gameDifficulty: number;
            gameMode: number;
            worldHeritage_TheStatueOfLiberty_EpRate: number;
            worldHeritage_TheStatueOfLiberty_EpNum: number;
            creativeModeSetting: {
                debugCraft: boolean;
                worldLevel: number;
                islandLevel: number;
                noDeath: boolean;
                noDamage: boolean;
                noHunger: boolean;
                infinitST: boolean;
                forceDayTime: number;
                noBuildingDamage: boolean;
                limitBuild: boolean;
            };
            plStartingData: {
                Level: number;
                Money: number;
                SkillPoint: number;
                EnchantPoint: number;
                Health: number;
                Mana: number;
                Stamina: number;
            };
            createdDate: {
                ticks: number;
            };
            maxPlayerNum: number;
        };
    };
}
