import CoinInstance, { Coin } from "./coin-instance";
import CredentialsInstance, { Attribute, Credential, CredentialStruct } from "./credentials-instance";
import DarcInstance from "./darc-instance";
import { PopPartyInstance } from "../../Personhood/pop-party-instance";
import * as PopPartyProto from "../../Personhood/proto";
import RoPaSciInstance, { RoPaSciStruct } from "../../Personhood/ro-pa-sci-instance";
import SpawnerInstance, { SpawnerStruct } from "./spawner-instance";

const coin = {
    Coin,
    CoinInstance,
};

const credentials = {
    Attribute,
    Credential,
    CredentialStruct,
    CredentialsInstance,
};

const darc = {
    DarcInstance,
};

const pop = {
    PopPartyInstance,
    ...PopPartyProto,
};

const game = {
    RoPaSciInstance,
    RoPaSciStruct,
};

const spawner = {
    SpawnerInstance,
    SpawnerStruct,
};

export {
    coin,
    credentials,
    darc,
    pop,
    game,
    spawner,
};
