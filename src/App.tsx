import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Softphone } from "./components/softphone";
import Dashboard from "./pages/Dashboard";

import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import JobEntry from "./pages/JobEntry";
import NewJobEntry from "./pages/NewJobEntry";
import CandidateSearch from "./pages/CandidateSearch";
import CandidateMatching from "./pages/CandidateMatching";
import TierAssignment from "./pages/TierAssignment";
import EnrichmentReview from "./pages/EnrichmentReview";
import LaunchConfirmation from "./pages/LaunchConfirmation";
import Campaigns from "./pages/Campaigns";
import CampaignBuilder from "./pages/CampaignBuilder";
import CampaignDetail from "./pages/CampaignDetail";
import Communications from "./pages/Communications";
import Enrichment from "./pages/Enrichment";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/jobs" element={<Jobs />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/jobs/new" element={<JobEntry />} />
          <Route path="/jobs/entry" element={<NewJobEntry />} />
          <Route path="/candidates/search" element={<CandidateSearch />} />
          <Route path="/candidates/matching" element={<CandidateMatching />} />
          <Route path="/candidates/tiers" element={<TierAssignment />} />
          <Route path="/candidates/enrichment" element={<EnrichmentReview />} />
          <Route path="/campaigns/launch" element={<LaunchConfirmation />} />
          <Route path="/campaigns" element={<Campaigns />} />
          <Route path="/campaigns/new" element={<CampaignBuilder />} />
          <Route path="/campaigns/:id" element={<CampaignDetail />} />
          <Route path="/communications" element={<Communications />} />
          
          <Route path="/enrichment" element={<Enrichment />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Softphone />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;