import React, { useState } from 'react';
import { Box, FormControlLabel, FormGroup, Switch, TextField } from '@mui/material';
import './CreateNote.css';
import Button from '@mui/material/Button';
import { Event, EventTemplate, getEventHash, Kind, SimplePool, validateEvent } from 'nostr-tools';
import { sanitizeString } from '../utils/sanitizeUtils';
import { FullEventData } from '../nostr/Types';

interface RelaySwitches {
  [relayUrl: string]: boolean;
}

interface Props {
  pool: SimplePool | null;
  relays: string[];
  pk: string;
  replyEventData: FullEventData | null;
  setPostedNote: () => void;
}


function CreateNote({pool, relays, pk, replyEventData, setPostedNote}: Props) {
  const [input, setInput] = useState("");
  const relaylist = relays.reduce((obj, relay) => {
    obj[relay] = true;
    return obj;
  }, {} as RelaySwitches);
  const [relaySwitches, setRelaysSwitches] = useState(relaylist);

  const handleRelaySwitchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRelaysSwitches(prevState => ({
      ...prevState,
      [event.target.id]: !prevState[event.target.id]
    }));
  };

  const handlePostToRelaysClick = async () => {

    if (!pool || pk === "") {
      alert("You need to install a Nostr extension to post to the relays")
      return;
    }
    
    const tags = replyEventData ? [
      [
        "e",
        replyEventData.eventId,
        "",
        "root"
      ],
      [
        "p",
        pk
      ]
    ]
    : [];

    

    const relaysToPostTo = relays.filter(relay => relaySwitches[relay]);
    console.log("relays to post: " + relaysToPostTo);

    //cunstruct the event
    const _baseEvent = {
      kind: Kind.Text,
      content: sanitizeString(input),
      created_at: Math.floor(Date.now() / 1000),
      tags: tags,
    } as EventTemplate

    try {
      const pubkey = pk;
      //prompt the user to sign the event
      const sig = (await window.nostr.signEvent(_baseEvent)).sig;
      
      const newEvent: Event = {
        ..._baseEvent,
        id: getEventHash({..._baseEvent, pubkey}),
        sig,
        pubkey,
      }
      
      console.log(validateEvent(newEvent))

      //post the event to the relays
      const pubs = pool.publish(relaysToPostTo, newEvent)

      let clearedInput = false;
      
      setPostedNote();

      pubs.on("ok", (pub: any) => {
        console.log(`Posted to ${pub}`)
        if (clearedInput) return;
        clearedInput = true;
        setInput("");
      })

      pubs.on("failed", (error: string) => {
        alert("Failed to post to relays" + error)
      })

    } catch (error) {
      alert("Canceled")
      console.log(error);
    }
  };
  return (
  <Box sx={{ marginTop: "20px",height: "auto", width: "auto"}} >
      <FormGroup>
        <TextField
          id="noteContent"
          label="What's on your mind?"
          variant="outlined"
          fullWidth
          multiline
          value={input}
          onChange={(e) => setInput(e.target.value)}
          focused 
          rows={12}
          margin="normal"
        />
        <Button type="button" variant="contained" color='secondary' onClick={handlePostToRelaysClick}>Post {replyEventData ? "Reply" : "Note"} To Relays</Button>
        <div className='relayListContainer'>
          {relays.map((relay) => (
            <div className='relaySwitch' key={relay}>
              <FormControlLabel control={<Switch id={relay} checked={relaySwitches[relay]} size='small' onChange={handleRelaySwitchChange}/>} label={relay} />
            </div>
          ))}
        </div>
      </FormGroup>
    </Box>
  )
}

export default CreateNote