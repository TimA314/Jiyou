import { Event, EventTemplate, Filter, SimplePool, finishEvent, getEventHash, nip19, validateEvent } from "nostr-tools";
import { Keys } from "./Types";
import { addMessage } from "../redux/slices/noteSlice";
import { Dispatch } from "react";
import { AnyAction } from "@reduxjs/toolkit";


export const signEventWithNostr = async (
pool: SimplePool,
relays: string[], 
event: EventTemplate,
dispatch: Dispatch<AnyAction>
) => {

    if (!window.nostr){
        return false;
    }

    try {        
        const pubkey = await window.nostr.getPublicKey();
        const sig = (await window.nostr.signEvent(event)).sig;
        
        const newEvent: Event = {
            ...event,
            id: getEventHash({...event, pubkey}),
            sig,
            pubkey,
        }
        

        pool.publish(relays, newEvent);

        let eventKindMessage = ""

        switch (newEvent.kind){
          case 0: {
            eventKindMessage = "Published Profile MetaData"
            break;
          }
          case 1: {
            eventKindMessage = "Published Note"
            break;
          }
          case 10002: {
            eventKindMessage = "Published Relay Settings"
            break
          }
          case 7: {
            eventKindMessage = "Published Like"
          }

        }
        console.log("eventKindMessage: " + eventKindMessage)
        if (eventKindMessage === "") return true;
        dispatch(addMessage({message: eventKindMessage, isError: false}))
        return true;
    } catch {
        return false;
    }
}

export const signEventWithStoredSk = async (
pool: SimplePool,
keys: Keys,
relays: string[],
event: EventTemplate,
dispatch: Dispatch<AnyAction>
) => {

    if (keys.privateKey.decoded === "") {
        dispatch(addMessage({ message: "Invalid secret key, check settings or use a Nostr extension", isError: true }));
        return false;
    }
    
    const signedEvent = finishEvent(event, keys.privateKey.decoded);
    const validated = validateEvent(signedEvent);

    if (!validated) {
        dispatch(addMessage({ message: 'Invalid event', isError: true }));
        return false;
    }
  
    pool.publish(relays, signedEvent);
    let eventKindMessage = ""

    switch (signedEvent.kind){
      case 0: {
        eventKindMessage = "Published Profile MetaData"
        break;
      }
      case 1: {
        eventKindMessage = "Published Note"
        break;
      }
      case 10002: {
        eventKindMessage = "Published Relay Settings"
        break
      }
      case 7: {
        eventKindMessage = "Published Like"
      }

    }
    console.log("eventKindMessage: " + eventKindMessage)
    if (eventKindMessage === "") return true;
    dispatch(addMessage({message: eventKindMessage, isError: false}))
    return true;
}
