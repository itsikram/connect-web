import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

const StoryReacts = () => {
    const { storyId } = useParams();
    return <Navigate to={`/story/${storyId}#reacts`} replace />;
};

export default StoryReacts;
