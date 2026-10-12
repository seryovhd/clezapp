// Campañas de flujo por frase
import React, { useState, useEffect, useContext } from "react";
import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";
import Paper from "@material-ui/core/Paper";
import Button from "@material-ui/core/Button";
import IconButton from "@material-ui/core/IconButton";

import DeleteOutlineIcon from "@material-ui/icons/DeleteOutline";
import EditIcon from "@material-ui/icons/Edit";

import MainContainer from "../../components/MainContainer";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";

import api from "../../services/api";
import { i18n } from "../../translate/i18n";
import ConfirmationModal from "../../components/ConfirmationModal";
import toastError from "../../errors/toastError";
import { isArray } from "lodash";
import { AddCircle, TextFields } from "@mui/icons-material";
import { CircularProgress, Grid, Stack } from "@mui/material";
import { Can } from "../../components/Can";
import { AuthContext } from "../../context/Auth/AuthContext";
import CampaignModalPhrase from "../../components/CampaignModalPhrase";
import { Typography } from "@mui/material";

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    borderRadius: 12,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
}));

const CampaignsPhrase = () => {
  const classes = useStyles();
  const history = useHistory();
  const { user } = useContext(AuthContext);

  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [deletingCampaign, setDeletingCampaign] = useState(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [deletingContact, setDeletingContact] = useState(null);
  const [ModalOpenPhrase, setModalOpenPhrase] = useState(false);
  const [campaignflowSelected, setCampaignFlowSelected] = useState();
  const [campaignflows, setCampaignFlows] = useState([]);

  const handleDeleteCampaign = async (campaignId) => {
    try {
      await api.delete(`/flowcampaign/${campaignId}`);
      toast.success("Frase eliminada con éxito");
      getCampaigns();
    } catch (err) {
      toastError(err);
    }
  };

  const getCampaigns = async () => {
    setLoading(true);
    await api
      .get("/flowcampaign")
      .then((res) => {
        setCampaignFlows(res.data.flow);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const onSaveModal = () => {
    getCampaigns();
  };

  useEffect(() => {
    getCampaigns();
  }, []);

  return (
    <MainContainer>
      <ConfirmationModal
        title={
          deletingCampaign &&
          `${i18n.t("campaigns.confirmationModal.deleteTitle")} ${
            deletingCampaign.name
          }?`
        }
        open={confirmModalOpen}
        onClose={setConfirmModalOpen}
        onConfirm={() => handleDeleteCampaign(deletingContact.id)}
      >
        {i18n.t("campaigns.confirmationModal.deleteMessage")}
      </ConfirmationModal>

      <CampaignModalPhrase
        open={ModalOpenPhrase}
        onClose={() => setModalOpenPhrase(false)}
        FlowCampaignId={campaignflowSelected}
        onSave={onSaveModal}
      />

      <MainHeader>
        <Grid container spacing={2} style={{ width: "100%" }}>
          <Grid item xs={12} sm={8}>
            <Title>Campañas con flujo</Title>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Stack direction="row" spacing={1} justifyContent="flex-end">
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => history.push("/queue-integration")}
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontWeight: "bold",
                  px: 2
                }}
              >
                Regresar
              </Button>

              <Button
                variant="contained"
                color="default"
                onClick={() => history.push("/flowbuilders")}
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontWeight: "bold",
                  px: 2
                }}
              ><AddCircle sx={{ mr: 0.5 }} fontSize="small" />
                Flujos
              </Button>

              <Button
                variant="contained"
                color="primary"
                onClick={() => {
                  setCampaignFlowSelected();
                  setModalOpenPhrase(true);
                }}
                sx={{
                  borderRadius: "8px",
                  textTransform: "none",
                  fontWeight: "bold",
                  px: 2
                }}
              >
                <AddCircle sx={{ mr: 0.5 }} fontSize="small" />
                Nueva
              </Button>
            </Stack>
          </Grid>
        </Grid>
      </MainHeader>

      <Paper className={classes.mainPaper} variant="outlined">
        <Stack>
          <Grid container style={{ padding: "8px" }}>
            <Grid item xs={4}>
              Nombre
            </Grid>
            <Grid item xs={4} align="center">
              Estado
            </Grid>
            <Grid item xs={4} align="right">
              {i18n.t("contacts.table.actions")}
            </Grid>
          </Grid>

          {!loading &&
            campaignflows.map((flow) => (
              <Grid
                container
                key={flow.id}
                sx={{ padding: "8px", borderRadius: 4, marginTop: 0.5 }}
              >
                <Grid item xs={4}>
                  <Stack direction={"row"} alignItems={"center"}>
                    <TextFields />
                    <Typography style={{ marginLeft: 8 }}>{flow.name}</Typography>
                  </Stack>
                </Grid>
                <Grid item xs={4} align="center">
                  {flow.status ? "Activo" : "Desactivado"}
                </Grid>
                <Grid item xs={4} align="right">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setCampaignFlowSelected(flow.id);
                      setModalOpenPhrase(true);
                    }}
                  >
                    <EditIcon />
                  </IconButton>
                  <Can
                    role={user.profile}
                    perform="contacts-page:deleteContact"
                    yes={() => (
                      <IconButton
                        size="small"
                        onClick={() => {
                          setConfirmModalOpen(true);
                          setDeletingContact(flow);
                        }}
                      >
                        <DeleteOutlineIcon />
                      </IconButton>
                    )}
                  />
                </Grid>
              </Grid>
            ))}

          {loading && (
            <Stack justifyContent={"center"} alignItems={"center"} minHeight={"50vh"}>
              <CircularProgress />
            </Stack>
          )}
        </Stack>
      </Paper>
    </MainContainer>
  );
};

export default CampaignsPhrase;
