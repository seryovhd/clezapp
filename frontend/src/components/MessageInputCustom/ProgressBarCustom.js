import React from 'react';
import LinearProgress from '@material-ui/core/LinearProgress';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 100,
    maxWidth: 160,
  },
  progressContainer: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: theme.palette.type === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
  },
  progressBar: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#25d366',
  },
  percentText: {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: '#25d366',
    minWidth: 32,
    textAlign: 'right',
  },
}));

export default function LinearWithValueLabel({ progress = 0 }) {
  const classes = useStyles();
  const safeValue = Math.min(Math.max(Math.round(progress), 0), 100);

  return (
    <div className={classes.root}>
      <div className={classes.progressContainer}>
        <LinearProgress
          variant="determinate"
          value={safeValue}
          classes={{ bar: classes.progressBar }}
          style={{ height: 6, backgroundColor: 'transparent' }}
        />
      </div>
      <Typography className={classes.percentText}>
        {`${safeValue}%`}
      </Typography>
    </div>
  );
}