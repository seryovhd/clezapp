import React from "react";
import { makeStyles } from "@material-ui/styles";
import LabelOutlinedIcon from "@material-ui/icons/LabelOutlined";

const useStyles = makeStyles(() => ({
  tag: {
    display: "inline-flex",
    alignItems: "center",
    fontSize: "0.60rem",
    fontWeight: "bold",
    borderRadius: "6px",
    padding: "2px 6px",
    textTransform: "uppercase",
    gap: 4,
    color: "white",
    marginRight: "5px",
    whiteSpace: "nowrap",
  },
  icon: {
    fontSize: "0.75rem",
  },
}));

const ContactTag = ({ tag }) => {
  const classes = useStyles();

  return (
    <span className={classes.tag} style={{ backgroundColor: tag.color }}>
      <LabelOutlinedIcon className={classes.icon} />
      {tag.name}
    </span>
  );
};

export default ContactTag;
