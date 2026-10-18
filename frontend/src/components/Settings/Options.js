import React, { useEffect, useState } from "react";

import Grid from "@material-ui/core/Grid";
import MenuItem from "@material-ui/core/MenuItem";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Select from "@material-ui/core/Select";
import FormHelperText from "@material-ui/core/FormHelperText";
import TextField from "@material-ui/core/TextField";
import Title from "../Title";
import Paper from "@material-ui/core/Paper";
import Typography from "@material-ui/core/Typography";
import useSettings from "../../hooks/useSettings";
import { ToastContainer, toast } from "react-toastify";
import { makeStyles } from "@material-ui/core/styles";
import { grey, blue } from "@material-ui/core/colors";
import { Tabs, Tab, Button, CircularProgress } from "@material-ui/core";
import OnlyForSuperUser from "../../components/OnlyForSuperUser";
import useAuth from "../../hooks/useAuth.js";
import api from "../../services/api";

//import 'react-toastify/dist/ReactToastify.css';

const useStyles = makeStyles((theme) => ({
    container: {
        paddingTop: theme.spacing(4),
        paddingBottom: theme.spacing(4),
    },
    fixedHeightPaper: {
        padding: theme.spacing(2),
        display: "flex",
        overflow: "auto",
        flexDirection: "column",
        height: 240,
    },
    tab: {
        backgroundColor: theme.palette.options, //DARK MODE Whaticket SaaS//
        borderRadius: 4,
        width: "100%",
        "& .MuiTab-wrapper": {
            color: theme.palette.fontecor,
        }, //DARK MODE Whaticket SaaS//
        "& .MuiTabs-flexContainer": {
            justifyContent: "center",
        },
    },
    paper: {
        padding: theme.spacing(2),
        display: "flex",
        alignItems: "center",
        marginBottom: 12,
        width: "100%",
    },
    cardAvatar: {
        fontSize: "55px",
        color: grey[500],
        backgroundColor: "#ffffff",
        width: theme.spacing(7),
        height: theme.spacing(7),
    },
    cardTitle: {
        fontSize: "18px",
        color: blue[700],
    },
    cardSubtitle: {
        color: grey[600],
        fontSize: "14px",
    },
    alignRight: {
        textAlign: "right",
    },
    fullWidth: {
        width: "100%",
    },
    selectContainer: {
        width: "100%",
        textAlign: "left",
    },
}));

export default function Options(props) {
    const { settings, scheduleTypeChanged } = props;
    const classes = useStyles();

    const [currentUser, setCurrentUser] = useState({});
    const { getCurrentUserInfo } = useAuth();
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        async function findData() {
            setLoading(true);
            try {
                const user = await getCurrentUserInfo();
                setCurrentUser(user);
            } catch (e) {
                toast.error(e);
            }
            setLoading(false);
        }
        findData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const isSuper = () => {
        return currentUser.super;
    };

    const [userRating, setUserRating] = useState("disabled");
    const [scheduleType, setScheduleType] = useState("disabled");
    const [callType, setCallType] = useState("enabled");
    const [chatbotType, setChatbotType] = useState("");
    const [CheckMsgIsGroup, setCheckMsgIsGroupType] = useState("enabled");

    const [loadingUserRating, setLoadingUserRating] = useState(false);
    const [loadingScheduleType, setLoadingScheduleType] = useState(false);
    const [loadingCallType, setLoadingCallType] = useState(false);
    const [loadingChatbotType, setLoadingChatbotType] = useState(false);
    const [loadingCheckMsgIsGroup, setCheckMsgIsGroup] = useState(false);

    const [viewclosed, setviewclosed] = useState("disabled");
    const [loadingviewclosed, setLoadingviewclosed] = useState(false);

    const [viewgroups, setviewgroups] = useState("disabled");
    const [loadingviewgroups, setLoadingviewgroups] = useState(false);
    // PARCHE 1.3.1 - RECORDAR AGENTE
    const [rememberCustomerAgent, setRememberCustomerAgent] = useState("disabled");
    const [loadingRememberAgent, setLoadingRememberAgent] = useState(false);
    // PARCHE 1.3.1 - RECORDAR AGENTE FIN
    const [showTicketWaitTime, setShowTicketWaitTime] = useState("disabled");
    const [loadingShowTicketWaitTime, setLoadingShowTicketWaitTime] = useState(false);
    const [quickMessagesMode, setQuickMessagesMode] = useState("both");
    const [loadingQuickMessagesMode, setLoadingQuickMessagesMode] = useState(false);

    const [ipixcType, setIpIxcType] = useState("");
    const [loadingIpIxcType, setLoadingIpIxcType] = useState(false);
    const [tokenixcType, setTokenIxcType] = useState("");
    const [loadingTokenIxcType, setLoadingTokenIxcType] = useState(false);

    const [ipmkauthType, setIpMkauthType] = useState("");
    const [loadingIpMkauthType, setLoadingIpMkauthType] = useState(false);
    const [clientidmkauthType, setClientIdMkauthType] = useState("");
    const [loadingClientIdMkauthType, setLoadingClientIdMkauthType] = useState(false);
    const [clientsecretmkauthType, setClientSecrectMkauthType] = useState("");
    const [loadingClientSecrectMkauthType, setLoadingClientSecrectMkauthType] = useState(false);

    const [asaasType, setAsaasType] = useState("");
    const [loadingAsaasType, setLoadingAsaasType] = useState(false);

    // recursos a mais...
    const [trial, settrial] = useState("3");
    const [loadingtrial, setLoadingtrial] = useState(false);

    const [viewregister, setviewregister] = useState("disabled");
    const [loadingviewregister, setLoadingviewregister] = useState(false);

    const [allowregister, setallowregister] = useState("disabled");
    const [loadingallowregister, setLoadingallowregister] = useState(false);

    const [SendGreetingAccepted, setSendGreetingAccepted] = useState("disabled");
    const [loadingSendGreetingAccepted, setLoadingSendGreetingAccepted] = useState(false);

    const [SettingsTransfTicket, setSettingsTransfTicket] = useState("disabled");
    const [loadingSettingsTransfTicket, setLoadingSettingsTransfTicket] = useState(false);

    const [sendGreetingMessageOneQueues, setSendGreetingMessageOneQueues] = useState("disabled");
    const [loadingSendGreetingMessageOneQueues, setLoadingSendGreetingMessageOneQueues] = useState(false);

    const [HubNotificaMeType, setHubNotificaMeType] = useState("");
    const [loadingHubNotificaMeType, setLoadingHubNotificaMeType] = useState(false);

    // Evolution API States
    const [evolutionApiUrl, setEvolutionApiUrl] = useState("http://localhost:8080");
    const [evolutionApiKey, setEvolutionApiKey] = useState("");
    const [evolutionApiEnabled, setEvolutionApiEnabled] = useState("enabled");
    const [loadingEvolution, setLoadingEvolution] = useState(false);
    const [testingEvolution, setTestingEvolution] = useState(false);

    const [tabConfigIndex, setTabConfigIndex] = useState(0);
    const [tabMainIndex, setTabMainIndex] = useState(0);
    const [tabHubIndex, setTabHubIndex] = useState(0);
    const [tabEvolutionIndex, setTabEvolutionIndex] = useState(0);

    const { update } = useSettings();

    useEffect(() => {
        if (Array.isArray(settings) && settings.length) {
            const userRating = settings.find((s) => s.key === "userRating");
            if (userRating) {
                setUserRating(userRating.value);
            }
            const scheduleType = settings.find((s) => s.key === "scheduleType");
            if (scheduleType) {
                setScheduleType(scheduleType.value);
            }
            const callType = settings.find((s) => s.key === "call");
            if (callType) {
                setCallType(callType.value);
            }
            const CheckMsgIsGroup = settings.find((s) => s.key === "CheckMsgIsGroup");
            if (CheckMsgIsGroup) {
                setCheckMsgIsGroupType(CheckMsgIsGroup.value);
            }

            const allowregister = settings.find((s) => s.key === "allowregister");
            if (allowregister) {
                setallowregister(allowregister.value);
            }

            const viewclosed = settings.find((s) => s.key === "viewclosed");
            if (viewclosed) {
                setviewclosed(viewclosed.value);
            }

            const viewgroups = settings.find((s) => s.key === "viewgroups");
            if (viewgroups) {
                setviewgroups(viewgroups.value);
            }
            // PARCHE 1.3.1 - RECORDAR AGENTE
            const rememberCustomerAgentSetting = settings.find((s) => s.key === "rememberCustomerAgent");
            if (rememberCustomerAgentSetting) {
                setRememberCustomerAgent(rememberCustomerAgentSetting.value);
            }
            // PARCHE 1.3.1 - RECORDAR AGENTE FIN
            const showTicketWaitTimeSetting = settings.find((s) => s.key === "showTicketWaitTime");
            if (showTicketWaitTimeSetting) {
                setShowTicketWaitTime(showTicketWaitTimeSetting.value);
            }
            const quickMessagesModeSetting = settings.find((s) => s.key === "quickMessagesMode");
            if (quickMessagesModeSetting) {
                setQuickMessagesMode(quickMessagesModeSetting.value);
            }
            {
                /*Whaticket SaaS SAUDAÇÃO*/
            }
            const SendGreetingAccepted = settings.find((s) => s.key === "sendGreetingAccepted");
            if (SendGreetingAccepted) {
                setSendGreetingAccepted(SendGreetingAccepted.value);
            }
            {
                /*Whaticket SaaS SAUDAÇÃO*/
            }

            {
                /*TRANSFERIR TICKET*/
            }
            const SettingsTransfTicket = settings.find((s) => s.key === "sendMsgTransfTicket");
            if (SettingsTransfTicket) {
                setSettingsTransfTicket(SettingsTransfTicket.value);
            }
            {
                /*TRANSFERIR TICKET*/
            }

            const viewregister = settings.find((s) => s.key === "viewregister");
            if (viewregister) {
                setviewregister(viewregister.value);
            }

            const sendGreetingMessageOneQueues = settings.find((s) => s.key === "sendGreetingMessageOneQueues");
            if (sendGreetingMessageOneQueues) {
                setSendGreetingMessageOneQueues(sendGreetingMessageOneQueues.value);
            }

            const chatbotType = settings.find((s) => s.key === "chatBotType");
            if (chatbotType) {
                setChatbotType(chatbotType.value);
            }

            const trial = settings.find((s) => s.key === "trial");
            if (trial) {
                settrial(trial.value);
            }

            const ipixcType = settings.find((s) => s.key === "ipixc");
            if (ipixcType) {
                setIpIxcType(ipixcType.value);
            }

            const tokenixcType = settings.find((s) => s.key === "tokenixc");
            if (tokenixcType) {
                setTokenIxcType(tokenixcType.value);
            }

            const ipmkauthType = settings.find((s) => s.key === "ipmkauth");
            if (ipmkauthType) {
                setIpMkauthType(ipmkauthType.value);
            }

            const clientidmkauthType = settings.find((s) => s.key === "clientidmkauth");
            if (clientidmkauthType) {
                setClientIdMkauthType(clientidmkauthType.value);
            }

            const clientsecretmkauthType = settings.find((s) => s.key === "clientsecretmkauth");
            if (clientsecretmkauthType) {
                setClientSecrectMkauthType(clientsecretmkauthType.value);
            }

            const asaasType = settings.find((s) => s.key === "asaas");
            if (asaasType) {
                setAsaasType(asaasType.value);
            }

            const evoUrl = settings.find((s) => s.key === "evolutionApiUrl");
            if (evoUrl && evoUrl.value) {
                setEvolutionApiUrl(evoUrl.value);
            }

            const evoKey = settings.find((s) => s.key === "evolutionApiKey");
            if (evoKey && evoKey.value) {
                setEvolutionApiKey(evoKey.value);
            }

            const evoEnabled = settings.find((s) => s.key === "evolutionApiEnabled");
            if (evoEnabled && evoEnabled.value) {
                setEvolutionApiEnabled(evoEnabled.value);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings]);

    async function handleEvolutionApiUrlChange(value) {
        setEvolutionApiUrl(value);
        setLoadingEvolution(true);
        await update({
            key: "evolutionApiUrl",
            value,
        });
        setLoadingEvolution(false);
    }

    async function handleEvolutionApiKeyChange(value) {
        setEvolutionApiKey(value);
        setLoadingEvolution(true);
        await update({
            key: "evolutionApiKey",
            value,
        });
        setLoadingEvolution(false);
    }

    async function handleEvolutionApiEnabledChange(value) {
        setEvolutionApiEnabled(value);
        setLoadingEvolution(true);
        await update({
            key: "evolutionApiEnabled",
            value,
        });
        toast.success("Estado de Evolution API actualizado.");
        setLoadingEvolution(false);
    }

    async function handleTestEvolutionConnection() {
        setTestingEvolution(true);
        try {
            const { data } = await api.post("/evolution/test-connection", {
                url: evolutionApiUrl,
                apiKey: evolutionApiKey,
            });
            if (data.success) {
                toast.success(data.message);
            } else {
                toast.error(data.message);
            }
        } catch (err) {
            toast.error(err?.response?.data?.message || "Error al conectar con Evolution API");
        }
        setTestingEvolution(false);
    }

    async function handleChangeUserRating(value) {
        setUserRating(value);
        setLoadingUserRating(true);
        await update({
            key: "userRating",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingUserRating(false);
    }

    async function handleallowregister(value) {
        setallowregister(value);
        setLoadingallowregister(true);
        await update({
            key: "allowregister",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingallowregister(false);
    }

    async function handleviewclosed(value) {
        setviewclosed(value);
        setLoadingviewclosed(true);
        await update({
            key: "viewclosed",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingviewclosed(false);
    }

    async function handleviewgroups(value) {
        setviewgroups(value);
        setLoadingviewgroups(true);
        await update({
            key: "viewgroups",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingviewgroups(false);
    }
    // PARCHE 1.3.1 - RECORDAR AGENTE
    async function handleRememberAgentChange(value) {
        setRememberCustomerAgent(value);
        setLoadingRememberAgent(true);
        await update({
            key: "rememberCustomerAgent",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingRememberAgent(false);
    }
    // PARCHE 1.3.1 - RECORDAR AGENTE FIN

    async function handleShowTicketWaitTime(value) {
        setShowTicketWaitTime(value);
        setLoadingShowTicketWaitTime(true);
        await update({
            key: "showTicketWaitTime",
            value,
        });
        localStorage.setItem("showTicketWaitTime", value);
        window.dispatchEvent(new Event("settings-update"));
        toast.success("Operación actualizada con éxito.");
        setLoadingShowTicketWaitTime(false);
    }
    async function handleSendGreetingMessageOneQueues(value) {
        setSendGreetingMessageOneQueues(value);
        setLoadingSendGreetingMessageOneQueues(true);
        await update({
            key: "sendGreetingMessageOneQueues",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingSendGreetingMessageOneQueues(false);
    }

    async function handleviewregister(value) {
        setviewregister(value);
        setLoadingviewregister(true);
        await update({
            key: "viewregister",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingviewregister(false);
    }

    async function handletrial(value) {
        settrial(value);
        setLoadingtrial(true);
        await update({
            key: "trial",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingtrial(false);
    }

    async function handleScheduleType(value) {
        setScheduleType(value);
        setLoadingScheduleType(true);
        await update({
            key: "scheduleType",
            value,
        });
        //toast.success("Oraçãpeo atualizada com sucesso.");
        toast.success("Operación actualizada con éxito.", {
            position: "top-right",
            autoClose: 2000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: false,
            draggable: true,
            theme: "light",
        });
        setLoadingScheduleType(false);
        if (typeof scheduleTypeChanged === "function") {
            scheduleTypeChanged(value);
        }
    }

    async function handleCallType(value) {
        setCallType(value);
        setLoadingCallType(true);
        await update({
            key: "call",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingCallType(false);
    }

    async function handleChatbotType(value) {
        setChatbotType(value);
        setLoadingChatbotType(true);
        await update({
            key: "chatBotType",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingChatbotType(false);
    }

    async function handleGroupType(value) {
        setCheckMsgIsGroupType(value);
        setCheckMsgIsGroup(true);
        await update({
            key: "CheckMsgIsGroup",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setCheckMsgIsGroupType(false);
        /*     if (typeof scheduleTypeChanged === "function") {
          scheduleTypeChanged(value);
        } */
    }

    {
        /*NOVO CÓDIGO*/
    }
    async function handleSendGreetingAccepted(value) {
        setSendGreetingAccepted(value);
        setLoadingSendGreetingAccepted(true);
        await update({
            key: "sendGreetingAccepted",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingSendGreetingAccepted(false);
    }

    {
        /*NOVO CÓDIGO*/
    }

    async function handleSettingsTransfTicket(value) {
        setSettingsTransfTicket(value);
        setLoadingSettingsTransfTicket(true);
        await update({
            key: "sendMsgTransfTicket",
            value,
        });

        toast.success("Operación actualizada con éxito.");
        setLoadingSettingsTransfTicket(false);
    }

    async function handleQuickMessagesMode(value) {
        setQuickMessagesMode(value);
        setLoadingQuickMessagesMode(true);
        await update({
            key: "quickMessagesMode",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingQuickMessagesMode(false);
    }

    async function handleChangeHubNotificaMe(value) {
        setHubNotificaMeType(value);

        if (value.length === 36) {
            // ✅ Solo si tiene 36 caracteres exactos
            setLoadingHubNotificaMeType(true);
            await update({
                key: "hubToken",
                value,
            });
            toast.success("Operación actualizada con éxito.");
            setLoadingHubNotificaMeType(false);
        } else {
            // Opcional: puedes mostrar un aviso si quieres
            // toast.info("Debe tener exactamente 36 caracteres para guardar.");
        }
    }

    async function handleChangeIPIxc(value) {
        setIpIxcType(value);
        setLoadingIpIxcType(true);
        await update({
            key: "ipixc",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingIpIxcType(false);
    }

    async function handleChangeTokenIxc(value) {
        setTokenIxcType(value);
        setLoadingTokenIxcType(true);
        await update({
            key: "tokenixc",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingTokenIxcType(false);
    }

    async function handleChangeIpMkauth(value) {
        setIpMkauthType(value);
        setLoadingIpMkauthType(true);
        await update({
            key: "ipmkauth",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingIpMkauthType(false);
    }

    async function handleChangeClientIdMkauth(value) {
        setClientIdMkauthType(value);
        setLoadingClientIdMkauthType(true);
        await update({
            key: "clientidmkauth",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingClientIdMkauthType(false);
    }

    async function handleChangeClientSecrectMkauth(value) {
        setClientSecrectMkauthType(value);
        setLoadingClientSecrectMkauthType(true);
        await update({
            key: "clientsecretmkauth",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingClientSecrectMkauthType(false);
    }

    async function handleChangeAsaas(value) {
        setAsaasType(value);
        setLoadingAsaasType(true);
        await update({
            key: "asaas",
            value,
        });
        toast.success("Operación actualizada con éxito.");
        setLoadingAsaasType(false);
    }
    return (
        <>
            <Grid spacing={3} container>
                <Grid xs={12} sm={12} md={12} item>
                    <FormControl className={classes.selectContainer}>
                        <InputLabel id="ratings-label">Reseñas</InputLabel>
                        <Select
                            labelId="ratings-label"
                            value={userRating}
                            onChange={async (e) => {
                                handleChangeUserRating(e.target.value);
                            }}
                        >
                            <MenuItem value={"disabled"}>No</MenuItem>
                            <MenuItem value={"enabled"}>Si</MenuItem>
                        </Select>
                        <FormHelperText>{loadingUserRating && "Atualizando..."}</FormHelperText>
                    </FormControl>
                </Grid>
                <Grid xs={12} sm={12} md={12} item>
                    <FormControl className={classes.selectContainer}>
                        <InputLabel id="schedule-type-label">Gestión del horario comercial</InputLabel>
                        <Select
                            labelId="schedule-type-label"
                            value={scheduleType}
                            onChange={async (e) => {
                                handleScheduleType(e.target.value);
                            }}
                        >
                            <MenuItem value={"disabled"}>Desactivado</MenuItem>
                            <MenuItem value={"queue"}>Fila</MenuItem>
                            <MenuItem value={"company"}>Empresa</MenuItem>
                        </Select>
                        <FormHelperText>{loadingScheduleType && "Atualizando..."}</FormHelperText>
                    </FormControl>
                </Grid>
                <Grid xs={12} sm={12} md={12} item>
                    <FormControl className={classes.selectContainer}>
                        <InputLabel id="group-type-label">Ignorar mensajes de grupo</InputLabel>
                        <Select
                            labelId="group-type-label"
                            value={CheckMsgIsGroup}
                            onChange={async (e) => {
                                handleGroupType(e.target.value);
                            }}
                        >
                            <MenuItem value={"disabled"}>No</MenuItem>
                            <MenuItem value={"enabled"}>Si</MenuItem>
                        </Select>
                        <FormHelperText>{loadingScheduleType && "Atualizando..."}</FormHelperText>
                    </FormControl>
                </Grid>
                <Grid xs={12} sm={12} md={12} item>
                    <FormControl className={classes.selectContainer}>
                        <InputLabel id="call-type-label">Aceptar LLamadas</InputLabel>
                        <Select
                            labelId="call-type-label"
                            value={callType}
                            onChange={async (e) => {
                                handleCallType(e.target.value);
                            }}
                        >
                            <MenuItem value={"disabled"}>No</MenuItem>
                            <MenuItem value={"enabled"}>Si</MenuItem>
                        </Select>
                        <FormHelperText>{loadingCallType && "Atualizando..."}</FormHelperText>
                    </FormControl>
                </Grid>
                <Grid xs={12} sm={12} md={12} item>
                    <FormControl className={classes.selectContainer}>
                        <InputLabel id="chatbot-type-label">Tipo Chatbot</InputLabel>
                        <Select
                            labelId="chatbot-type-label"
                            value={chatbotType}
                            onChange={async (e) => {
                                handleChatbotType(e.target.value);
                            }}
                        >
                            <MenuItem value={"text"}>Texto</MenuItem>
                            {/*<MenuItem value={"button"}>Botão</MenuItem>*/}
                            {/*<MenuItem value={"list"}>Lista</MenuItem>*/}
                        </Select>
                        <FormHelperText>{loadingChatbotType && "Atualizando..."}</FormHelperText>
                    </FormControl>
                </Grid>
                {/* ENVIAR SAUDAÇÃO AO ACEITAR O TICKET */}
                <Grid xs={12} sm={12} md={12} item>
                    <FormControl className={classes.selectContainer}>
                        <InputLabel id="sendGreetingAccepted-label">Enviar saludo al aceptar el ticket</InputLabel>
                        <Select
                            labelId="sendGreetingAccepted-label"
                            value={SendGreetingAccepted}
                            onChange={async (e) => {
                                handleSendGreetingAccepted(e.target.value);
                            }}
                        >
                            <MenuItem value={"disabled"}>No</MenuItem>
                            <MenuItem value={"enabled"}>Si</MenuItem>
                        </Select>
                        <FormHelperText>{loadingSendGreetingAccepted && "Atualizando..."}</FormHelperText>
                    </FormControl>
                </Grid>
                {/* ENVIAR SAUDAÇÃO AO ACEITAR O TICKET */}

                {/* ENVIAR MENSAGEM DE TRANSFERENCIA DE SETOR/ATENDENTE */}
                <Grid xs={12} sm={12} md={12} item>
                    <FormControl className={classes.selectContainer}>
                        <InputLabel id="sendMsgTransfTicket-label">
                            Enviar mensaje de transferencia de Fila/Agente
                        </InputLabel>
                        <Select
                            labelId="sendMsgTransfTicket-label"
                            value={SettingsTransfTicket}
                            onChange={async (e) => {
                                handleSettingsTransfTicket(e.target.value);
                            }}
                        >
                            <MenuItem value={"disabled"}>No</MenuItem>
                            <MenuItem value={"enabled"}>Si</MenuItem>
                        </Select>
                        <FormHelperText>{loadingSettingsTransfTicket && "Atualizando..."}</FormHelperText>
                    </FormControl>
                </Grid>

                {/* ENVIAR SAUDAÇÃO QUANDO HOUVER SOMENTE 1 FILA */}
                <Grid xs={12} sm={12} md={12} item>
                    <FormControl className={classes.selectContainer}>
                        <InputLabel id="sendGreetingMessageOneQueues-label">
                            Enviar saludo cuando solo 1 en Fila
                        </InputLabel>
                        <Select
                            labelId="sendGreetingMessageOneQueues-label"
                            value={sendGreetingMessageOneQueues}
                            onChange={async (e) => {
                                handleSendGreetingMessageOneQueues(e.target.value);
                            }}
                        >
                            <MenuItem value={"disabled"}>No</MenuItem>
                            <MenuItem value={"enabled"}>Si</MenuItem>
                        </Select>
                        <FormHelperText>{loadingSendGreetingMessageOneQueues && "Atualizando..."}</FormHelperText>
                    </FormControl>
                </Grid>
                <Grid xs={12} sm={12} md={12} item>
                    <FormControl className={classes.selectContainer}>
                        <InputLabel id="viewclosed-label">¿El operador ve tickets cerrados?</InputLabel>
                        <Select
                            labelId="viewclosed-label"
                            value={viewclosed}
                            onChange={async (e) => {
                                handleviewclosed(e.target.value);
                            }}
                        >
                            <MenuItem value={"disabled"}>No</MenuItem>
                            <MenuItem value={"enabled"}>Si</MenuItem>
                        </Select>
                        <FormHelperText>{loadingviewclosed && "Atualizando..."}</FormHelperText>
                    </FormControl>
                </Grid>

                <Grid xs={12} sm={12} md={12} item>
                    <FormControl className={classes.selectContainer}>
                        <InputLabel id="viewgroups-label">¿El operador Visualiza Grupos?</InputLabel>
                        <Select
                            labelId="viewgroups-label"
                            value={viewgroups}
                            onChange={async (e) => {
                                handleviewgroups(e.target.value);
                            }}
                        >
                            <MenuItem value={"disabled"}>No</MenuItem>
                            <MenuItem value={"enabled"}>Si</MenuItem>
                        </Select>
                        <FormHelperText>{loadingviewgroups && "Atualizando..."}</FormHelperText>
                    </FormControl>
                </Grid>
                {/* PARCHE 1.3.1 - RECORDAR AGENTE */}
                <Grid xs={12} sm={12} md={12} item>
                    <FormControl className={classes.selectContainer}>
                        <InputLabel id="remember-agent-label">¿Recordar agente asignado?</InputLabel>
                        <Select
                            labelId="remember-agent-label"
                            value={rememberCustomerAgent}
                            onChange={async (e) => {
                                handleRememberAgentChange(e.target.value);
                            }}
                        >
                            <MenuItem value="disabled">No</MenuItem>
                            <MenuItem value="enabled">Sí</MenuItem>
                        </Select>
                        <FormHelperText>{loadingRememberAgent && "Actualizando..."}</FormHelperText>
                    </FormControl>
                </Grid>
                {/* PARCHE 1.3.1 - RECORDAR AGENTE FIN */}
                {/* MOSTRAR TIEMPO DE ESPERA / ÚLTIMA INTERACCIÓN */}
                <Grid xs={12} sm={12} md={12} item>
                    <FormControl className={classes.selectContainer}>
                        <InputLabel id="showTicketWaitTime-label">
                            ¿Mostrar tiempo de última interacción en tickets?
                        </InputLabel>
                        <Select
                            labelId="showTicketWaitTime-label"
                            value={showTicketWaitTime}
                            onChange={async (e) => {
                                handleShowTicketWaitTime(e.target.value);
                            }}
                        >
                            <MenuItem value="disabled">No</MenuItem>
                            <MenuItem value="enabled">Sí</MenuItem>
                        </Select>
                        <FormHelperText>{loadingShowTicketWaitTime && "Actualizando..."}</FormHelperText>
                    </FormControl>
                </Grid>
                {/* MODO DE RESPUESTAS RÁPIDAS (QUICK MESSAGES) */}
                <Grid xs={12} sm={12} md={12} item>
                    <FormControl className={classes.selectContainer}>
                        <InputLabel id="quickMessagesMode-label">
                            Modo de Respuestas Rápidas (Chat)
                        </InputLabel>
                        <Select
                            labelId="quickMessagesMode-label"
                            value={quickMessagesMode}
                            onChange={async (e) => {
                                handleQuickMessagesMode(e.target.value);
                            }}
                        >
                            <MenuItem value={"both"}>Ambos (Flotante al escribir "/" y Carrusel de botones)</MenuItem>
                            <MenuItem value={"floating"}>WhatsApp Web (Solo Flotante al escribir "/")</MenuItem>
                            <MenuItem value={"carousel"}>Carrusel Tradicional (Solo botones superiores)</MenuItem>
                        </Select>
                        <FormHelperText>{loadingQuickMessagesMode && "Actualizando..."}</FormHelperText>
                    </FormControl>
                </Grid>
            </Grid>

            <OnlyForSuperUser
                user={currentUser}
                yes={() => (
                    <>
                        <Grid spacing={3} container>
                            {/* PARCHE 1.3 BASE */}
                            <Tabs
                                value={tabConfigIndex}
                                onChange={(e, newValue) => setTabConfigIndex(newValue)}
                                indicatorColor="primary"
                                textColor="primary"
                                scrollButtons="on"
                                variant="scrollable"
                                className={classes.tab}
                                style={{ marginBottom: 20, marginTop: 20 }}
                            >
                                <Tab label="Configuración global" />
                            </Tabs>
                            {/* PARCHE 1.3 BASE - FIN */}
                        </Grid>

                        <Grid xs={12} sm={12} md={12} item>
                            <FormControl className={classes.selectContainer}>
                                <InputLabel id="allowregister-label">¿Se permite el registro (inscripción)?</InputLabel>
                                <Select
                                    labelId="allowregister-label"
                                    value={allowregister}
                                    onChange={async (e) => {
                                        handleallowregister(e.target.value);
                                    }}
                                >
                                    <MenuItem value={"disabled"}>No</MenuItem>
                                    <MenuItem value={"enabled"}>Si</MenuItem>
                                </Select>
                                <FormHelperText>{loadingallowregister && "Atualizando..."}</FormHelperText>
                            </FormControl>
                        </Grid>

                        <Grid xs={12} sm={12} md={12} item>
                            <FormControl className={classes.selectContainer}>
                                <InputLabel id="viewregister-label">¿Registro (Inscripción) Visible?</InputLabel>
                                <Select
                                    labelId="viewregister-label"
                                    value={viewregister}
                                    onChange={async (e) => {
                                        handleviewregister(e.target.value);
                                    }}
                                >
                                    <MenuItem value={"disabled"}>No</MenuItem>
                                    <MenuItem value={"enabled"}>Si</MenuItem>
                                </Select>
                                <FormHelperText>{loadingviewregister && "Atualizando..."}</FormHelperText>
                            </FormControl>
                        </Grid>

                        <Grid xs={12} sm={12} md={12} item>
                            <FormControl className={classes.selectContainer}>
                                <InputLabel id="trial-label">¿Tiempo de prueba?</InputLabel>
                                <Select
                                    labelId="trial-label"
                                    value={trial}
                                    onChange={async (e) => {
                                        handletrial(e.target.value);
                                    }}
                                >
                                    <MenuItem value={"1"}>1</MenuItem>
                                    <MenuItem value={"2"}>2</MenuItem>
                                    <MenuItem value={"3"}>3</MenuItem>
                                    <MenuItem value={"4"}>4</MenuItem>
                                    <MenuItem value={"5"}>5</MenuItem>
                                    <MenuItem value={"6"}>6</MenuItem>
                                    <MenuItem value={"7"}>7</MenuItem>
                                </Select>
                                <FormHelperText>{loadingtrial && "Atualizando..."}</FormHelperText>
                            </FormControl>
                        </Grid>
                    </>
                )}
            />
            <Grid spacing={3} container>
                <Tabs
                    indicatorColor="primary"
                    textColor="primary"
                    scrollButtons="on"
                    variant="scrollable"
                    className={classes.tab}
                    style={{
                        marginBottom: 20,
                        marginTop: 20,
                    }}
                >
                    {/*           <Tab

            label="INTEGRACIONES" /> */}
                </Tabs>
            </Grid>

            {/*-----------------HUB NOTIFICAME-----------------*/}
            <Grid spacing={3} container style={{ marginBottom: 10 }}>
                <Tabs
                    value={tabHubIndex}
                    onChange={(e, newValue) => setTabHubIndex(newValue)}
                    indicatorColor="primary"
                    textColor="primary"
                    scrollButtons="on"
                    variant="scrollable"
                    className={classes.tab}
                >
                    <Tab label="HUB NOTIFICAME" />
                </Tabs>
                <Grid xs={12} sm={12} md={12} item>
                    <FormControl className={classes.selectContainer}>
                        <TextField
                            id="HubNotificaMe"
                            name="HubNotificaMe"
                            margin="dense"
                            label="Token Account"
                            variant="outlined"
                            value={HubNotificaMeType}
                            onChange={async (e) => {
                                handleChangeHubNotificaMe(e.target.value);
                            }}
                        ></TextField>
                        <FormHelperText>{loadingHubNotificaMeType && "Actualizando..."}</FormHelperText>
                    </FormControl>
                </Grid>
            </Grid>

            {/*-----------------EVOLUTION API v2-----------------*/}
            <Grid spacing={3} container style={{ marginBottom: 20 }}>
                <Tabs
                    value={tabEvolutionIndex}
                    onChange={(e, newValue) => setTabEvolutionIndex(newValue)}
                    indicatorColor="primary"
                    textColor="primary"
                    scrollButtons="on"
                    variant="scrollable"
                    className={classes.tab}
                    style={{ marginBottom: 15 }}
                >
                    <Tab label="🚀 MOTOR DE WHATSAPP: EVOLUTION API v2" />
                </Tabs>

                <Grid xs={12} sm={12} md={6} item>
                    <FormControl className={classes.selectContainer}>
                        <TextField
                            id="evolutionApiUrl"
                            name="evolutionApiUrl"
                            margin="dense"
                            label="URL del Servidor Evolution API"
                            placeholder="http://localhost:8080 o https://evolution.dominio.com"
                            variant="outlined"
                            value={evolutionApiUrl}
                            onChange={(e) => setEvolutionApiUrl(e.target.value)}
                            onBlur={(e) => handleEvolutionApiUrlChange(e.target.value)}
                            helperText={loadingEvolution ? "Guardando..." : "Dirección del servidor donde corre Evolution API"}
                        />
                    </FormControl>
                </Grid>

                <Grid xs={12} sm={12} md={6} item>
                    <FormControl className={classes.selectContainer}>
                        <TextField
                            id="evolutionApiKey"
                            name="evolutionApiKey"
                            margin="dense"
                            label="API Key Global de Evolution API"
                            placeholder="AUTHENTICATION_API_KEY"
                            variant="outlined"
                            type="password"
                            value={evolutionApiKey}
                            onChange={(e) => setEvolutionApiKey(e.target.value)}
                            onBlur={(e) => handleEvolutionApiKeyChange(e.target.value)}
                            helperText={loadingEvolution ? "Guardando..." : "Clave configurada en tu Evolution API"}
                        />
                    </FormControl>
                </Grid>

                <Grid xs={12} sm={12} md={6} item>
                    <FormControl className={classes.selectContainer}>
                        <InputLabel id="evolutionApiEnabled-label">¿Usar Evolution API por defecto?</InputLabel>
                        <Select
                            labelId="evolutionApiEnabled-label"
                            value={evolutionApiEnabled}
                            onChange={(e) => handleEvolutionApiEnabledChange(e.target.value)}
                        >
                            <MenuItem value={"enabled"}>Sí, usar Evolution API (Recomendado - Ultra Rápido)</MenuItem>
                            <MenuItem value={"disabled"}>No, usar Baileys local tradicional</MenuItem>
                        </Select>
                        <FormHelperText>Define el motor principal de conexión para WhatsApp</FormHelperText>
                    </FormControl>
                </Grid>

                <Grid xs={12} sm={12} md={6} item style={{ display: "flex", alignItems: "center", paddingTop: 16 }}>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleTestEvolutionConnection}
                        disabled={testingEvolution}
                        style={{ height: 44 }}
                    >
                        {testingEvolution ? (
                            <>
                                <CircularProgress size={20} style={{ color: "#fff", marginRight: 8 }} />
                                Probando Conexión...
                            </>
                        ) : (
                            "⚡ Probar Conexión con Evolution API"
                        )}
                    </Button>
                </Grid>
            </Grid>
        </>
    );
}
