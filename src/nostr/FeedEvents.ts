import { Event, EventTemplate, Filter, SimplePool, getEventHash } from "nostr-tools";
import * as secp from "@noble/secp256k1";
import { sanitizeEvent } from "../util";
import { ReactionCounts } from "./Types";
import { defaultRelays } from "./Relays";


export const getEventOptions = (hashtags: string[], tabIndex: number, followers: string[]) => {
    
    let options: Filter = {
        kinds: [1],
        limit: 50,
        since: Math.floor((Date.now() / 1000) - (3 * 24 * 60 * 60)) //3 days ago
    }
    
    switch (tabIndex) {
        case 0: //Global
            if(hashtags.length > 0) {
                options["#t"] = hashtags;
            }
            break;
        case 1: //Followers
            if(hashtags.length > 0) {
                options["#t"] = hashtags;
            }
            if(followers.length > 0){
                options.authors = followers;
            }
            break;
        default:
            break;
    }

    return options;
}

export const getFollowers = async (pool: SimplePool, relays: string[], tabIndex: number) => {
            
    if (!window.nostr) {
        if(tabIndex === 0) return;
        alert("You need to install a Nostr extension to provide your pubkey.")
        return;
    }
    try {
        const pk = await window.nostr.getPublicKey();
        
        const userFollowerEvent: Event[] = await pool.list([...defaultRelays, ...relays], [{kinds: [3], authors: [pk], limit: 1 }])
        let followerPks: string[] = [];
        if (!userFollowerEvent[0] || !userFollowerEvent[0].tags) return [];
        
        const followerArray: string[][] = userFollowerEvent[0].tags.filter((tag) => tag[0] === "p");
        for(let i=0; i<followerArray.length;i++){
            if(secp.utils.isValidPrivateKey(followerArray[i][1])){
                followerPks.push(followerArray[i][1]);
            }
        }

        console.log(followerPks.length + " followers found")
        return followerPks;
    } catch (error) {
        alert(error)
        console.log(error);
    }
}

export const getReplyThreadEvents = async (events: Event[], pool: SimplePool, relays: string[]) => {
    const eventIdsToFetch: string[] = [];
    events.forEach(event => {
        event.tags?.forEach(tag => {
            if(tag[0] === "e" && tag[1]){
                eventIdsToFetch.push(tag[1]);
            }
        })
    })

    if (eventIdsToFetch.length === 0) return;
    const replyThreadEvents: Event[] = await pool.list(relays, [{kinds: [1], ids: eventIdsToFetch }])
    if (!replyThreadEvents) return null;

    const sanitizedEvents = replyThreadEvents.map(event => sanitizeEvent(event));

    return sanitizedEvents;
}

export const getReactionEvents = async (events: Event[], pool: SimplePool, relays: string[], reactions: Record<string, ReactionCounts>) => {
    const retrievedReactionObjects: Record<string, ReactionCounts> = {};
    const eventIds = events.map((event) => event.id);
    const pubkeys = events.map((event) => event.pubkey);

    const reactionEvents = await pool.list(relays, [{ "kinds": [7], "#e": eventIds, "#p": pubkeys}]);

    reactionEvents.forEach((reactionEvent) => {
        if (!reactionEvent.tags) return;

        const isUpvote = reactionEvent.content === "+";
        const eventTagThatWasLiked = reactionEvent.tags.find((tag) => tag[0] === "e");

        if (eventTagThatWasLiked === undefined || !secp.utils.isValidPrivateKey(eventTagThatWasLiked[1])) return;

        const likeEventReactionObject = reactions[eventTagThatWasLiked![1]] ?? {upvotes: 0, downvotes: 0};

        if (isUpvote) {
            likeEventReactionObject.upvotes++;
        } else {
            likeEventReactionObject.downvotes++;
        }

        retrievedReactionObjects[eventTagThatWasLiked![1]] = likeEventReactionObject;
    });

    return retrievedReactionObjects;
}

export const setFollowing = async (followerPubkey: string, pool: SimplePool, followers: string[], relays: string[]) => {
    if (!pool) {
        alert("pool is null")
        return;
    }

    try {
        const pubkey = await window.nostr.getPublicKey();
        const userFollowerEvent: Event[] = await pool.list([...defaultRelays, ...relays], [{kinds: [3], authors: [pubkey], limit: 1 }])
        console.log("user follower event " + JSON.stringify(userFollowerEvent[0]))
        
        const isUnfollowing: boolean = !!userFollowerEvent.find((e) =>
            e.tags.some((t) => t[1] === followerPubkey)
        );

        console.log("setIsFollowing " + followerPubkey + " " + isUnfollowing)
        
        const currentTags = userFollowerEvent[0]?.tags || [];

        const newTags = isUnfollowing
            ? currentTags.filter((tag) => tag[1] !== followerPubkey)
            : currentTags.concat([["p", followerPubkey]]);

        const _baseEvent = {
            kind: 3,
            content: userFollowerEvent[0]?.content ?? "",
            created_at: Math.floor(Date.now() / 1000),
            tags: newTags,
        } as EventTemplate

        const sig = (await window.nostr.signEvent(_baseEvent)).sig;

        const newEvent: Event = {
            ..._baseEvent,
            id: getEventHash({..._baseEvent, pubkey}),
            sig,
            pubkey,
        }

        let pubs = pool.publish(relays, newEvent)
        
        pubs.on("ok", () => {
            alert("Posted to relays")
            console.log("Posted to relays")
        })

        pubs.on("failed", (error: string) => {
            alert("Failed to post to relays" + error)
        })

        return newTags.filter((tag) => tag[0] === "p").map((tag) => tag[1])
    } catch (error) {
        alert(error)
        console.log(error);
    }
}