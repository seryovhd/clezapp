import { Avatar, makeStyles } from '@material-ui/core';
import React from 'react';
import CopyNumberButton from '../../CopyNumberButton';

const useStyles = makeStyles(theme => ({
    container: {
        position: "relative",
        display: "flex",
        gap: "8px",
        alignItems: "center", 
        width: "100%"
    },
    titleAndSubtitleContainer: {
        maxWidth: "150px",
        display: "flex",
        flexShrink: 1,
        flexDirection: "column",
    },
    subtitle: {
        fontSize: "12px",
        fontWeight: "normal",
        color: (theme.palette?.type || theme.mode) === 'dark' ? "#8696a0" : "#667781",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        overflow: "hidden"
    },
    title: {
        color: (theme.palette?.type || theme.mode) === 'dark' ? "#e9edef" : "#111b21",
        fontWeight: 600,
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        overflow: "hidden"
    },
    deleteButton: {
        position: "absolute",
        right: "0px"
    }
  }));

const CardTitle = ({ticket, userProfile}) => {
    const classes = useStyles();

    return (
        <div className={classes.container}>
            <Avatar
                alt={ticket.contact.name} 
                src={ticket.contact.profilePicUrl}
            />
        <div className={classes.titlesAndDeleteButtonWrapper}>    
            <div className={classes.titleAndSubtitleContainer}>
                <span className={classes.title}>
                    {ticket.contact.name}
                </span>
                <span className={classes.subtitle} style={{ display: "inline-flex", alignItems: "center" }}>
                    <span>{ticket.contact.number}</span>
                    {ticket.contact.number && <CopyNumberButton number={ticket.contact.number} size={11} />}
                </span>
            </div>
        </div>
        </div>
    )
}

export default CardTitle;