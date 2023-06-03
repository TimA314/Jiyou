import * as React from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { EventTemplate, Kind, SimplePool, finishEvent, nip19, validateEvent } from 'nostr-tools';
import { Box } from '@mui/material';
import { ProfileContent } from '../nostr/Types';

interface SignEventDialogProps {
    signEventOpen: boolean;
    setSignEventOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setEventToSign: React.Dispatch<React.SetStateAction<EventTemplate | null>>;
    event: EventTemplate | null;
    pool: SimplePool | null;
    relays: string[];
    setProfile: React.Dispatch<React.SetStateAction<ProfileContent>>;
  }

export default function SignEventDialog({ signEventOpen, setSignEventOpen, setEventToSign, event, pool, relays, setProfile }: SignEventDialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('md'));


  const signEventManually = async () => {
    if (!pool){
      alert("No pool");
      return;
    };

    const secretKey = localStorage.getItem("sk");
    console.log("secret key: " + secretKey);
    const decodedSk = nip19.decode(secretKey ?? "");

    if (!decodedSk || decodedSk.data.toString().trim() === "") {
      alert("Invalid secret key");
      return;
    }

    if (!event){
      alert("No event found");
      return;
    }

    var signedEvent = finishEvent(event, decodedSk.data.toString());
    const validated = validateEvent(signedEvent);

    if (!validated) {
      alert("Invalid event");
      return;
    }

    const pubs = pool.publish(relays, signedEvent)
    
    pubs.on("ok", (pub: string) => {
      console.log("Posted to relay " + pub)
    })
    
    pubs.on("failed", (error: string) => {
      console.log("Failed to post to relay " + error)
    })

    setEventToSign(null);
    setSignEventOpen(false);

    if (signedEvent.kind === Kind.Metadata) {
      const profileContent = JSON.parse(signedEvent.content);

      const parsedContent: ProfileContent = {
        name: profileContent?.name ?? "",
        about: profileContent?.about ?? "",
        picture: profileContent?.picture ?? "",
        banner: profileContent?.banner ?? "",
      };

      setProfile(parsedContent);
    }
  }
  
  const handleClose = () => {
    setSignEventOpen(false);
  };

  const formattedEvent = event !== null ? JSON.stringify(event, null, 2) : 'No event found';


  return (
    <div>
      <Dialog
        fullScreen={fullScreen}
        open={signEventOpen}
        onClose={handleClose}
        aria-labelledby="responsive-dialog-title"
      >
        <DialogTitle id="responsive-dialog-title">
          {"Sign Event and send to relays"}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            <pre>{formattedEvent}</pre>
          </DialogContentText>
        </DialogContent>
          <Box sx={{display: "flex", justifyContent: "space-between", padding: "15px"}}>
            <Button autoFocus onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={signEventManually} color="secondary" autoFocus>
              Sign
            </Button>
          </Box>
      </Dialog>
    </div>
  );
}