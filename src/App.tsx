import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Jobs from "./pages/Jobs";
import JobDetail from "./pages/JobDetail";
import JobEntry from "./pages/JobEntry";
import NewJobEntry from "./pages/NewJobEntry";
import CandidateMatching from "./pages/CandidateMatching";
import CampaignBuilder from "./pages/CampaignBuilder";
import LaunchConfirmation from "./pages/LaunchConfirmation";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Jobs />} />
          <Route path="/jobs/new" element={<NewJobEntry />} />
          <Route path="/jobs/:id" element={<JobDetail />} />
          <Route path="/new-job" element={<JobEntry />} />
          <Route path="/candidates" element={<CandidateMatching />} />
          <Route path="/campaign-builder" element={<CampaignBuilder />} />
          <Route path="/launch" element={<LaunchConfirmation />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
