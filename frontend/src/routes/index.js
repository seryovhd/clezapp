import React, { useEffect, useState, lazy } from "react";
import { BrowserRouter, Switch } from "react-router-dom";
import { ToastContainer } from "react-toastify";

import LoggedInLayout from "../layout";
import Dashboard from "../pages/Dashboard/";
import TicketResponsiveContainer from "../pages/TicketResponsiveContainer";
import Signup from "../pages/Signup/";
import Login from "../pages/Login/";
import ForgetPassword from "../pages/ForgetPassWord/";

// Módulos operativos de alta frecuencia (Carga directa instantánea a 0ms sin loading)
import Connections from "../pages/Connections/";
import SettingsCustom from "../pages/SettingsCustom/";
import Users from "../pages/Users";
import Contacts from "../pages/Contacts/";
import Queues from "../pages/Queues/";
import Tags from "../pages/Tags/";
import QuickMessages from "../pages/QuickMessages/";
import Kanban from "../pages/Kanban";
import Chat from "../pages/Chat";

import { ForwardMessageProvider } from "../context/ForwarMessage/ForwardMessageContext";
import { AuthProvider } from "../context/Auth/AuthContext";
import { TicketsContextProvider } from "../context/Tickets/TicketsContext";
import { WhatsAppsProvider } from "../context/WhatsApp/WhatsAppsContext";
import Route from "./Route";

// Módulos administrativos y de uso esporádico (Carga perezosa Code-Splitting para aligerar la app)
const Financeiro = lazy(() => import("../pages/Financeiro/"));
const MessagesAPI = lazy(() => import("../pages/MessagesAPI/"));
const Helps = lazy(() => import("../pages/Helps/"));
const ContactLists = lazy(() => import("../pages/ContactLists/"));
const ContactListItems = lazy(() => import("../pages/ContactListItems/"));
const Schedules = lazy(() => import("../pages/Schedules"));
const Campaigns = lazy(() => import("../pages/Campaigns"));
const CampaignsConfig = lazy(() => import("../pages/CampaignsConfig"));
const CampaignReport = lazy(() => import("../pages/CampaignReport"));
const Annoucements = lazy(() => import("../pages/Annoucements"));
const ToDoList = lazy(() => import("../pages/ToDoList/"));
const Subscription = lazy(() => import("../pages/Subscription/"));
const Files = lazy(() => import("../pages/Files/"));
const Prompts = lazy(() => import("../pages/Prompts"));
const QueueIntegration = lazy(() => import("../pages/QueueIntegration"));
const LogLauncher = lazy(() => import("../pages/LogLauncher"));
const HubNotificaMe = lazy(() => import("../pages/HubNotificaMe"));
const Reportes = lazy(() => import("../pages/Reportes"));
const CampaignsPhrase = lazy(() => import("../pages/CampaignsPhrase"));
const FlowBuilder = lazy(() => import("../pages/FlowBuilder"));
const FlowBuilderConfig = lazy(() => import("../pages/FlowBuilderConfig"));

const Routes = () => {
  const [showCampaigns, setShowCampaigns] = useState(false);

  useEffect(() => {
    const cshow = localStorage.getItem("cshow");
    if (cshow !== undefined) {
      setShowCampaigns(true);
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
	  <ForwardMessageProvider>
        <TicketsContextProvider>
          <Switch>
            <Route exact path="/login" component={Login} />
            <Route exact path="/signup" component={Signup} />
			<Route exact path="/forgetpsw" component={ForgetPassword} /> 
            {/* <Route exact path="/create-company" component={Companies} /> */}
            <WhatsAppsProvider>
              <LoggedInLayout>
                <Route exact path="/" component={Dashboard} isPrivate />
                <Route
                  exact
                  path="/tickets/:ticketId?"
                  component={TicketResponsiveContainer}
                  isPrivate
                />
                <Route
                  exact
                  path="/connections"
                  component={Connections}
                  isPrivate
                />
                <Route
                  exact
                  path="/quick-messages"
                  component={QuickMessages}
                  isPrivate
                />
                <Route
                  exact
                  path="/todolist"
                  component={ToDoList}
                  isPrivate
                  />
                <Route
                  exact
                  path="/schedules"
                  component={Schedules}
                  isPrivate
                />
                <Route exact path="/tags" component={Tags} isPrivate />
                <Route exact path="/contacts" component={Contacts} isPrivate />
                <Route exact path="/helps" component={Helps} isPrivate />
                <Route exact path="/users" component={Users} isPrivate />
                <Route exact path="/files" component={Files} isPrivate />
                <Route exact path="/prompts" component={Prompts} isPrivate />
				<Route exact path="/LogLauncher" component={LogLauncher} isPrivate />
                <Route exact path="/queue-integration" component={QueueIntegration} isPrivate />
					{/*<Route exact path="/kanban-schedules" component={kanbanSchedules} isPrivate />*/}
                <Route
                  exact
                  path="/messages-api"
                  component={MessagesAPI}
                  isPrivate
                />
                <Route
                  exact
                  path="/settings"
                  component={SettingsCustom}
                  isPrivate
                />
				        <Route 
                  exact
                  path="/kanban"
                  component={Kanban}
                  isPrivate
                />
                <Route
                  exact
                  path="/reportes"
                  component={Reportes}
                  isPrivate
                />			
                <Route
                  exact
                  path="/financeiro"
                  component={Financeiro}
                  isPrivate
                />
                <Route exact path="/queues" component={Queues} isPrivate />
                <Route
                  exact
                  path="/announcements"
                  component={Annoucements}
                  isPrivate
                />
                <Route
                  exact
                  path="/subscription"
                  component={Subscription}
                  isPrivate
                />
                <Route exact path="/chats/:id?" component={Chat} isPrivate />
                {showCampaigns && (
                  <>
                    <Route
                      exact
                      path="/contact-lists"
                      component={ContactLists}
                      isPrivate
                    />
                    <Route
                      exact
                      path="/contact-lists/:contactListId/contacts"
                      component={ContactListItems}
                      isPrivate
                    />
                    <Route
                      exact
                      path="/campaigns"
                      component={Campaigns}
                      isPrivate
                    />
                    <Route
                      exact
                      path="/campaign/:campaignId/report"
                      component={CampaignReport}
                      isPrivate
                    />
                    <Route
                      exact
                      path="/campaigns-config"
                      component={CampaignsConfig}
                      isPrivate
                    />
                    {/* Ruta HubNotificaMe */}
                      <Route
                        exact
                        path="/hub-notificame"
                        component={HubNotificaMe}
                      isPrivate
                    />
                    <Route
                      exact
                      path="/phrase-lists"
                      component={CampaignsPhrase}
                      isPrivate
                    />
                    <Route
                      exact
                      path="/flowbuilders"
                      component={FlowBuilder}
                      isPrivate
                    />
                    <Route
                      exact
                      path="/flowbuilder/:id?"
                      component={FlowBuilderConfig}
                      isPrivate
                    />
                  </>
                )}
              </LoggedInLayout>
            </WhatsAppsProvider>
          </Switch>
          <ToastContainer autoClose={3000} />
        </TicketsContextProvider>
		</ForwardMessageProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Routes;
