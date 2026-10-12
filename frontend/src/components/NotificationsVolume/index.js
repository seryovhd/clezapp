import React from "react";
import { makeStyles } from "@material-ui/core/styles";
import { Grid, Slider } from "@material-ui/core";
import VolumeUpIcon from "@material-ui/icons/VolumeUp";
import VolumeDownIcon from "@material-ui/icons/VolumeDown";

const useStyles = makeStyles((theme) => ({
  root: {
    padding: theme.spacing(2),
    width: 200,
  },
}));

const NotificationsVolume = ({ volume, setVolume }) => {
  const classes = useStyles();

  const handleVolumeChange = (event, value) => {
    setVolume(value);
    localStorage.setItem("volume", value);
  };

  return (
    <div className={classes.root}>
      <Grid container spacing={2} alignItems="center">
        <Grid item>
          <VolumeDownIcon />
        </Grid>
        <Grid item xs>
          <Slider
            value={volume}
            step={0.1}
            min={0}
            max={1}
            onChange={handleVolumeChange}
            aria-labelledby="volume-slider"
          />
        </Grid>
        <Grid item>
          <VolumeUpIcon />
        </Grid>
      </Grid>
    </div>
  );
};

export default NotificationsVolume;
