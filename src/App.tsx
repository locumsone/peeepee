import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Softphone } from "./components/softphone";
import { AuthGuard } from "./components/auth/AuthGuard";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
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
import CampaignCandidates from "./pages/CampaignCandidates";
import CampaignChannels from "./pages/CampaignChannels";
import CampaignReview from "./pages/CampaignReview";
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
          {/* Public routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          
          {/* Protected routes */}
          <Route path="/" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/dashboard" element={<AuthGuard><Dashboard /></AuthGuard>} />
          <Route path="/jobs" element={<AuthGuard><Jobs /></AuthGuard>} />
          <Route path="/jobs/:id" element={<AuthGuard><JobDetail /></AuthGuard>} />
          <Route path="/jobs/new" element={<AuthGuard><JobEntry /></AuthGuard>} />
          <Route path="/jobs/entry" element={<AuthGuard><NewJobEntry /></AuthGuard>} />
          <Route path="/candidates/search" element={<AuthGuard><CandidateSearch /></AuthGuard>} />
          <Route path="/candidates/matching" element={<AuthGuard><CandidateMatching /></AuthGuard>} />
          <Route path="/candidates/tiers" element={<AuthGuard><TierAssignment /></AuthGuard>} />
          <Route path="/candidates/enrichment" element={<AuthGuard><EnrichmentReview /></AuthGuard>} />
          
          {/* Legacy campaign routes (singular /campaign/) */}
          <Route path="/campaign/tiers" element={<AuthGuard><TierAssignment /></AuthGuard>} />
          <Route path="/campaign/review" element={<AuthGuard><EnrichmentReview /></AuthGuard>} />
          <Route path="/campaign/launch" element={<AuthGuard><LaunchConfirmation /></AuthGuard>} />
          
          <Route path="/campaigns/launch" element={<AuthGuard><LaunchConfirmation /></AuthGuard>} />
          <Route path="/campaigns" element={<AuthGuard><Campaigns /></AuthGuard>} />
          <Route path="/campaigns/new" element={<AuthGuard><CampaignBuilder /></AuthGuard>} />
          <Route path="/campaigns/new/candidates" element={<AuthGuard><CampaignCandidates /></AuthGuard>} />
          <Route path="/campaigns/new/channels" element={<AuthGuard><CampaignChannels /></AuthGuard>} />
          <Route path="/campaigns/new/review" element={<AuthGuard><CampaignReview /></AuthGuard>} />
          <Route path="/campaigns/:id" element={<AuthGuard><CampaignDetail /></AuthGuard>} />
          <Route path="/communications" element={<AuthGuard><Communications /></AuthGuard>} />
          <Route path="/enrichment" element={<AuthGuard><Enrichment /></AuthGuard>} />
          
          <Route path="*" element={<NotFound />} />
        </Routes>
        <Softphone />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
