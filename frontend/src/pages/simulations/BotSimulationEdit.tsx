import React from "react";
import { useParams } from "react-router-dom";
import BotSimulationForm from "../../components/simulations/BotSimulationForm";

const BotSimulationEdit: React.FC = () => {
  const { id } = useParams<{ id: string }>();

  return <BotSimulationForm mode="edit" simulationId={id} />;
};

export default BotSimulationEdit;
