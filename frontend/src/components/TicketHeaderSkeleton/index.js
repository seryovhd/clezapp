import React from "react";

import { makeStyles } from "@material-ui/core/styles";
import { Card, CardHeader } from "@material-ui/core";
import Skeleton from "@material-ui/lab/Skeleton";

const useStyles = makeStyles(theme => ({
	ticketHeader: {
		display: "flex",
		backgroundColor: theme.palette.tabHeaderBackground,
		flex: "none",
		borderBottom: theme.palette.divider
			? `1px solid ${theme.palette.divider}`
			: "1px solid rgba(0, 0, 0, 0.12)",
		alignItems: "center",
		justifyContent: "space-between",
		paddingRight: 16,
		[theme.breakpoints.down("sm")]: {
			flexWrap: "wrap",
		},
	},
	actionSkeleton: {
		display: "flex",
		alignItems: "center",
		marginLeft: "auto",
		"& > *": {
			margin: theme.spacing(0.5),
		},
	},
}));

const TicketHeaderSkeleton = () => {
	const classes = useStyles();

	return (
		<Card square className={classes.ticketHeader}>
			<CardHeader
				titleTypographyProps={{ noWrap: true }}
				subheaderTypographyProps={{ noWrap: true }}
				avatar={
					<Skeleton animation="wave" variant="circle" width={40} height={40} />
				}
				title={<Skeleton animation="wave" width={120} height={20} />}
				subheader={<Skeleton animation="wave" width={160} height={16} />}
			/>
			<div className={classes.actionSkeleton}>
				<Skeleton
					animation="wave"
					variant="rect"
					width={95}
					height={32}
					style={{ borderRadius: 16 }}
				/>
			</div>
		</Card>
	);
};

export default TicketHeaderSkeleton;
