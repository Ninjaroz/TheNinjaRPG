import { type NextPage } from "next";
import Loader from "@/layout/Loader";
import { ClansOverview, ClanProfile } from "@/layout/Clan";
import { useRequireInVillage } from "@/utils/village";

const Clans: NextPage = () => {
  // Must be in allied village
  const { userData, access } = useRequireInVillage("/clanhall");

  // Loaders
  if (!userData) return <Loader explanation="Loading userdata" />;
  if (!access) return <Loader explanation="Accessing Clan Hall" />;
  if (userData.isOutlaw) return <Loader explanation="Unlikely to find outlaw clans" />;

  // Render
  if (userData.clanId) {
    return <ClanProfile clanId={userData.clanId} userData={userData} />;
  } else {
    return <ClansOverview userData={userData} />;
  }
};

export default Clans;
