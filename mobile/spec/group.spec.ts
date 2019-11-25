import { curve } from "@dedis/kyber";
import Log from "../app/lib/cothority/log";
import { KeyPair } from "../app/lib/dynacred/KeyPair";
import { GroupContract, IGroupContract } from "../app/lib/group/groupContract";
import { GroupDefinition, IGroupDefinition } from "../app/lib/group/groupDefinition";
import GroupContractCollection from "../app/lib/group/groupDefinitionCollection";

describe("Group Management", () => {
    it("Test GroupContractCollection", () => {
        const user1 = new KeyPair();
        const user2 = new KeyPair();

        // creation of the GroupContractCollection
        const purpose: string = "Test";
        const gdCollection = new GroupContractCollection(purpose);

        // creation of the first group definition
        const orginialVar = {
            orgPubKeys: [user1._public.toHex(), user2._public.toHex()],
            suite: "edwards25519",
            voteThreshold: ">=1/2",
            purpose,
        };
        let gd = new GroupDefinition(orginialVar);
        let contract1 = gdCollection.proposeGroupContract(undefined, gd);

        // user1 exchanges the first group definition
        gdCollection.sign(contract1, user1._private);

        // user2 receives the group definition by JSON
        let jsonContract: IGroupContract = contract1.toJSON();
        const user2Contract1 = GroupContract.createFromJSON(jsonContract);

        // user2 accepts the group definition
        gdCollection.sign(user2Contract1, user2._private);

        // user1 receives back the group definition by JSON
        jsonContract = user2Contract1.toJSON();
        contract1 = GroupContract.createFromJSON(jsonContract);

        // update group definition Collection
        gdCollection.append(contract1);

        // first test
        expect(gdCollection.has(contract1)).toBeTruthy();
        expect(gdCollection.get(contract1.id)).toEqual(contract1);
        expect(gdCollection.getWorldView(contract1)).toEqual([contract1]);
        Log.print("First part of test GroupDefinitionList passed!");

        // new user
        // const user3 = new KeyPair();

        // // propose user3 as a new member in a new group definition
        // const newVar = contract1.groupDefinition;
        // newVar.orgPubKeys.push(user3._public.toHex());
        // gd = new GroupDefinition(newVar);
        // let contract2: GroupContract = contract1.proposeGroupContract(gd);
        // // append to the group definition collection
        // gdCollection.append(contract2);

        // // user1 exchanges the first group definition
        // contract2.sign(user1._private);

        // // user2 receives the group definition by JSON
        // jsonContract = contract2.toJSON();
        // const user2contract2 = GroupContract.createFromJSON(jsonContract);

        // // user2 accepts the group definition
        // user2contract2.sign(user2._private);

        // // user3 receives the group definition by JSON
        // jsonContract = user2contract2.toJSON();
        // const user3contract2 = GroupContract.createFromJSON(jsonContract);

        // // user3 signs the group definition
        // user3contract2.sign(user3._private);

        // // user1 gets back the group definition
        // jsonContract = user3contract2.toJSON();
        // contract2 = GroupContract.createFromJSON(jsonContract);
        // gdCollection.append(contract2);

        // // Second tests
        // expect(gdCollection.get(contract2.id)).toEqual(contract2);
        // expect(gdCollection.getChildren(contract1)).toEqual([contract2]);
        // // expect(gdCollection.isAccepted(contract1)).toBeTruthy();
        // expect(gdCollection.isAccepted(contract2)).toBeTruthy();
        // expect(gdCollection.getWorldView(contract1)).toEqual([[contract1, contract2]]);
        // expect(gdCollection.getWorldView(contract2)).toEqual([contract2]);
        // expect(gdCollection.getCurrentGroupContract(user1._public)).toEqual(contract2);
        // Log.print("Second part of test GroupDescriptionCollection is passed!");
    });
    // it("Test multiple signature by same user", () => {
    //     const user1 = new KeyPair();
    //     const user2 = new KeyPair();

    //     // creation of the first group definition
    //     const originalVar = {
    //         orgPubKeys: [user1._public.toHex(), user2._public.toHex()],
    //         suite: "edwards25519",
    //         voteThreshold: ">=1/2",
    //         purpose: "Test",
    //     };
    //     const gd = new GroupDefinition(originalVar);
    //     const contract1 = new GroupContract(gd);

    //     // user1 exchanges the first group definition
    //     contract1.sign(user1._private);
    //     contract1.sign(user1._private);

    //     // user2 receives the group definition by JSON
    //     const jsonGD: IGroupContract = contract1.toJSON();
    //     const user2OriginalGD = GroupContract.createFromJSON(jsonGD);

    //     // user2 accepts the group definition
    //     user2OriginalGD.sign(user2._private);

    //     expect(user2OriginalGD.verify()).toBeFalsy();
    //     Log.print("Test multiple signature by same user passed!");
    // });
    // it("Test getWorldView with multiple branches", () => {
    //     const user1 = new KeyPair();
    //     const user2 = new KeyPair();

    //     // creation of the first group definition
    //     let variables: IGroupDefinition = {
    //         orgPubKeys: [user1._public.toHex(), user2._public.toHex()],
    //         suite: "edwards25519",
    //         voteThreshold: ">1/2",
    //         purpose: "Test",
    //     };

    //     // creates four group definitions
    //     //          gc0
    //     //          / \
    //     //        gc1  gc3
    //     //        /
    //     //      gc2
    //     const gcCollection = new GroupContractCollection(variables.purpose);
    //     let gd = new GroupDefinition(variables);
    //     const gc0 = new GroupContract(gd);

    //     variables = gc0.groupDefinition;
    //     variables.voteThreshold = ">=2/5";
    //     gd = new GroupDefinition(variables);
    //     const gc1 = gc0.proposeGroupContract(gd);

    //     sleep(1000);

    //     variables = gc1.groupDefinition;
    //     variables.voteThreshold = ">=1/3";
    //     gd = new GroupDefinition(variables);
    //     const gd2 = gc1.proposeGroupContract(gd);

    //     sleep(1000);

    //     variables = gc0.groupDefinition;
    //     variables.voteThreshold = ">9/10";
    //     gd = new GroupDefinition(variables);
    //     const gd3 = gc0.proposeGroupContract(gd);

    //     sleep(1000);

    //     gcCollection.append(gc0);
    //     gcCollection.append(gc1);
    //     gcCollection.append(gd2);
    //     gcCollection.append(gd3);

    //     expect(gcCollection.getWorldView(gc0)).toEqual([[gc0, gc1, gd2], [gc0, gd3]]);
    //     Log.print("Test getWorldView with multiples branches passed!");
    //     expect(gcCollection.getCurrentGroupContract(user1._public)).toEqual(undefined);
    // });
});

// // helping method
function sleep(milliseconds) {
    const start = new Date().getTime();
    for (let i = 0; i < 1e7; i++) {
        if ((new Date().getTime() - start) > milliseconds) {
            break;
        }
    }
}
