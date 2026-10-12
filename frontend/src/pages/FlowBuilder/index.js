import React, { useState, useEffect, useReducer, useContext } from "react";

import { toast } from "react-toastify";
import { useHistory } from "react-router-dom";

import { makeStyles } from "@material-ui/core/styles";

import Paper from "@material-ui/core/Paper";
import SearchIcon from "@material-ui/icons/Search";
import TextField from "@material-ui/core/TextField";
import InputAdornment from "@material-ui/core/InputAdornment";

import api from "../../services/api";
import ConfirmationModal from "../../components/ConfirmationModal";

import { i18n } from "../../translate/i18n";
import MainHeader from "../../components/MainHeader";
import Title from "../../components/Title";
import MainHeaderButtonsWrapper from "../../components/MainHeaderButtonsWrapper";
import MainContainer from "../../components/MainContainer";
import toastError from "../../errors/toastError";
import { AuthContext } from "../../context/Auth/AuthContext";
import NewTicketModal from "../../components/NewTicketModal";
import { AddCircle, DevicesFold, MoreVert } from "@mui/icons-material";

import {
  Button,
  CircularProgress,
  Grid,
  Menu,
  MenuItem,
  Stack,
} from "@mui/material";

import FlowBuilderModal from "../../components/FlowBuilderModal";

const reducer = (state, action) => {
  if (action.type === "LOAD_CONTACTS") {
    const contacts = action.payload;
    const newContacts = [];

    contacts.forEach((contact) => {
      const contactIndex = state.findIndex((c) => c.id === contact.id);
      if (contactIndex !== -1) {
        state[contactIndex] = contact;
      } else {
        newContacts.push(contact);
      }
    });

    return [...state, ...newContacts];
  }

  if (action.type === "UPDATE_CONTACTS") {
    const contact = action.payload;
    const contactIndex = state.findIndex((c) => c.id === contact.id);

    if (contactIndex !== -1) {
      state[contactIndex] = contact;
      return [...state];
    } else {
      return [contact, ...state];
    }
  }

  if (action.type === "DELETE_CONTACT") {
    const contactId = action.payload;

    const contactIndex = state.findIndex((c) => c.id === contactId);
    if (contactIndex !== -1) {
      state.splice(contactIndex, 1);
    }
    return [...state];
  }

  if (action.type === "RESET") {
    return [];
  }
};

const useStyles = makeStyles((theme) => ({
  mainPaper: {
    flex: 1,
    borderRadius: 12,
    padding: theme.spacing(1),
    overflowY: "scroll",
    ...theme.scrollbarStyles,
  },
}));

const FlowBuilder = () => {
  const classes = useStyles();
  const history = useHistory();

  const [loading, setLoading] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const [searchParam, setSearchParam] = useState("");
  const [contacts, dispatch] = useReducer(reducer, []);
  const [webhooks, setWebhooks] = useState([]);
  const [selectedContactId, setSelectedContactId] = useState(null);
  const [selectedWebhookName, setSelectedWebhookName] = useState(null);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [newTicketModalOpen, setNewTicketModalOpen] = useState(false);
  const [contactTicket, setContactTicket] = useState({});
  const [deletingContact, setDeletingContact] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmDuplicateOpen, setConfirmDuplicateOpen] = useState(false);

  const [hasMore, setHasMore] = useState(false);
  const [reloadData, setReloadData] = useState(false);
  const { user, socket } = useContext(AuthContext);

  useEffect(() => {
    dispatch({ type: "RESET" });
    setPageNumber(1);
  }, [searchParam]);

  useEffect(() => {
    setLoading(true);
    const delayDebounceFn = setTimeout(() => {
      const fetchContacts = async () => {
        try {
          const { data } = await api.get("/flowbuilder");
          setWebhooks(data.flows);
          dispatch({ type: "LOAD_CONTACTS", payload: data.flows });
          setHasMore(data.hasMore);
        } catch (err) {
          toastError(err);
        } finally {
          setLoading(false);
        }
      };
      fetchContacts();
    }, 500);
    return () => clearTimeout(delayDebounceFn);
  }, [searchParam, pageNumber, reloadData]);

  const handleSearch = (event) => {
    setSearchParam(event.target.value.toLowerCase());
  };

  const handleOpenContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(true);
  };

  const handleCloseContactModal = () => {
    setSelectedContactId(null);
    setContactModalOpen(false);
  };

  const handleCloseOrOpenTicket = (ticket) => {
    setNewTicketModalOpen(false);
    if (ticket !== undefined && ticket.uuid !== undefined) {
      history.push(`/tickets/${ticket.uuid}`);
    }
  };

  const hadleEditContact = () => {
    setSelectedContactId(deletingContact.id);
    setSelectedWebhookName(deletingContact.name);
    setContactModalOpen(true);
  };

  const handleDeleteWebhook = async (webhookId) => {
    try {
      await api.delete(`/flowbuilder/${webhookId}`);
      setDeletingContact(null);
      setReloadData((old) => !old);
      toast.success("Flujo eliminado con éxito");
    } catch (err) {
      toastError(err);
    }
  };

  const handleDuplicateFlow = async (flowId) => {
    try {
      await api.post(`/flowbuilder/duplicate`, { flowId: flowId });
      setDeletingContact(null);
      setReloadData((old) => !old);
      toast.success("Flujo duplicado con éxito");
    } catch (err) {
      toastError(err);
    }
  };

  const loadMore = () => {
    setPageNumber((prevState) => prevState + 1);
  };

  const handleScroll = (e) => {
    if (!hasMore || loading) return;
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - (scrollTop + 100) < clientHeight) {
      loadMore();
    }
  };

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const handleClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const exportLink = () => {
    history.push(`/flowbuilder/${deletingContact.id}`);
  };

  return (
    <MainContainer className={classes.mainContainer}>
      <NewTicketModal
        modalOpen={newTicketModalOpen}
        initialContact={contactTicket}
        onClose={(ticket) => {
          handleCloseOrOpenTicket(ticket);
        }}
      />

      <FlowBuilderModal
        open={contactModalOpen}
        onClose={handleCloseContactModal}
        aria-labelledby="form-dialog-title"
        flowId={selectedContactId}
        nameWebhook={selectedWebhookName}
        onSave={() => setReloadData((old) => !old)}
      />

      <ConfirmationModal
        title={
          deletingContact
            ? `¿Deseas eliminar el flujo ${deletingContact.name}?`
            : `¿Importar datos?`
        }
        open={confirmOpen}
        onClose={setConfirmOpen}
        onConfirm={(e) =>
          deletingContact ? handleDeleteWebhook(deletingContact.id) : () => {}
        }
      >
        {deletingContact
          ? "¿Estás seguro de que deseas eliminar este flujo? Todas las integraciones relacionadas se perderán."
          : "¿Deseas importar los datos?"}
      </ConfirmationModal>

      <ConfirmationModal
        title={
          deletingContact
            ? `¿Deseas duplicar el flujo ${deletingContact.name}?`
            : `¿Importar datos?`
        }
        open={confirmDuplicateOpen}
        onClose={setConfirmDuplicateOpen}
        onConfirm={(e) =>
          deletingContact ? handleDuplicateFlow(deletingContact.id) : () => {}
        }
      >
        {deletingContact
          ? "¿Estás seguro de que deseas duplicar este flujo?"
          : "¿Deseas importar los datos?"}
      </ConfirmationModal>

      <MainHeader>
        <Title>Flujos de conversación</Title>
<MainHeaderButtonsWrapper style={{ display: "flex", alignItems: "center", gap: 12 }}>
  <TextField
    placeholder="Buscar..."
    type="search"
    value={searchParam}
    onChange={handleSearch}
    size="small"
    InputProps={{
      startAdornment: (
        <InputAdornment position="start">
          <SearchIcon style={{ color: "gray" }} />
        </InputAdornment>
      ),
    }}
    sx={{
      width: "250px",
    }}
  />

  <Button
    variant="outlined"
    color="secondary"
    onClick={() => history.push("/phrase-lists")}
    sx={{
      borderRadius: "8px",
      textTransform: "none",
      fontWeight: "bold",
      px: 2,
      height: "38px",
      marginRight: "10px"
    }}
  >
    Regresar
  </Button>

  <Button
    variant="contained"
    color="primary"
    onClick={handleOpenContactModal}
    sx={{
      borderRadius: "8px",
      textTransform: "none",
      fontWeight: "bold",
      px: 2,
      height: "38px"
    }}
  >
    <AddCircle sx={{ mr: 0.5 }} fontSize="small" />
    Agregar flujo
  </Button>
</MainHeaderButtonsWrapper>

      </MainHeader>

      <Paper
        className={classes.mainPaper}
        variant="outlined"
        onScroll={handleScroll}
      >
        <Stack>
          <Grid container style={{ padding: "8px" }}>
            <Grid item xs={4}>Nombre</Grid>
            <Grid item xs={4} align="center">Estado</Grid>
            <Grid item xs={4} align="end">Acciones</Grid>
          </Grid>

          {webhooks.map((contact) => (
            <Grid
              container
              key={contact.id}
              sx={{
                padding: "8px",
                borderRadius: 2,
                marginTop: 0.5,
              }}
            >
              <Grid
                item
                xs={4}
                onClick={() => history.push(`/flowbuilder/${contact.id}`)}
              >
                <Stack
                  justifyContent="center"
                  height="100%"
                  style={{ color: "#252525" }}
                >
                  <Stack direction="row">
                    <DevicesFold />
                    <Stack justifyContent="center" marginLeft={1}>
                      {contact.name}
                    </Stack>
                  </Stack>
                </Stack>
              </Grid>

              <Grid
                item
                xs={4}
                align="center"
                style={{ color: "#252525" }}
                onClick={() => history.push(`/flowbuilder/${contact.id}`)}
              >
                <Stack justifyContent="center" height="100%">
                  {contact.active ? "Activo" : "Inactivo"}
                </Stack>
              </Grid>

              <Grid item xs={4} align="end">
                <Button
                  id="basic-button"
                  aria-controls={open ? "basic-menu" : undefined}
                  aria-haspopup="true"
                  aria-expanded={open ? "true" : undefined}
                  onClick={(e) => {
                    handleClick(e);
                    setDeletingContact(contact);
                  }}
                  sx={{ borderRadius: "36px", minWidth: "24px" }}
                >
                  <MoreVert
                    sx={{ color: "#252525", width: "21px", height: "21px" }}
                  />
                </Button>
              </Grid>
            </Grid>
          ))}

          <Menu
            id="basic-menu"
            anchorEl={anchorEl}
            open={open}
            sx={{ borderRadius: "40px" }}
            onClose={handleClose}
            MenuListProps={{
              "aria-labelledby": "basic-button",
            }}
          >
            <MenuItem
              onClick={() => {
                handleClose();
                hadleEditContact();
              }}
            >
              Editar nombre
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleClose();
                exportLink();
              }}
            >
              Editar flujo
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleClose();
                setConfirmDuplicateOpen(true);
              }}
            >
              Duplicar
            </MenuItem>
            <MenuItem
              onClick={() => {
                handleClose();
                setConfirmOpen(true);
              }}
            >
              Eliminar
            </MenuItem>
          </Menu>

          {loading && (
            <Stack
              justifyContent="center"
              alignItems="center"
              minHeight="50vh"
            >
              <CircularProgress />
            </Stack>
          )}
        </Stack>
      </Paper>
    </MainContainer>
  );
};

export default FlowBuilder;
