EV Fleet Telemetry REST API & Dashboard
A scalable, full-stack application designed to process high-volume telemetry data from 10,000+ EV vehicles and provide real-time fleet insights, trip detection, and anomaly alerting.

Tech Stack
Backend: Node.js, Express.js, MongoDB (Mongoose)
Frontend: React 18, Vite, Tailwind CSS v3, Chart.js
Data Seeding: Python 3, pymongo

Setup Instructions

Prerequisites
Node.js (v20.12+ recommended)
MongoDB (Running locally on port 27017)
Python 3 & pip
1. Clone & Install Dependencies
git clone https://github.com/NagendraOO7/ev_fleet_backend.git ev-fleet-api# Install Backendcd backendnpm installcd ..# Install Frontendcd clientnpm installcd ..
2. Seed the Database
Run the Python script to generate vehicles and 7 days of realistic telemetry data.

bash

pip install pymongo
python3 pythonseed.py
(Note: By default, this seeds 100 vehicles to ensure fast local testing. You can modify NUM_VEHICLES inside the script).

