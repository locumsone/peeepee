import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import JobEntry from "./pages/JobEntry";
import NewJobEntry from "./pages/NewJobEntry";
import CandidateMatching from "./pages/CandidateMatching";
import CandidateSearch from "./pages/CandidateSearch";
import EnrichmentReview from "./pages/EnrichmentReview";
import TierAssignment from "./pages/TierAssignment";
import CampaignBuilder from "./pages/CampaignBuilder";
import LaunchConfirmation from "./pages/LaunchConfirmation";
import Campaigns from "./pages/Campaigns";
import CampaignDetail from "./pages/CampaignDetail";
import NotFound from "./pages/NotFound";
import { Softphone } from "./components/softphone/Softphone";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/new" element={<NewJobEntry />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/new-job" element={<JobEntry />} />
          <Route path="/candidates" element={<CandidateMatching />} />
          <Route path="/candidates/search" element={<CandidateSearch />} />
          <Route path="/campaign/tiers" element={<TierAssignment />} />
          <Route path="/campaign/enrich" element={<EnrichmentReview />} />
          <Route path="/campaign/launch" element={<LaunchConfirmation />} />
          <Route path="/campaign-builder" element={<CampaignBuilder />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Softphone />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
