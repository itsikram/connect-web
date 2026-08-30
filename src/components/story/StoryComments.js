import React from 'react';
import { Navigate, useParams } from 'react-router-dom';

const StoryComments = () => {
    const { storyId } = useParams();
    return <Navigate to={`/story/${storyId}#comments`} replace />;
};

export default StoryComments;
